/**
 * Project: Space Station — Main Entry Point
 * Bootstraps the Apple IIe emulator, loads disk images, and wires up the UI.
 */
import { Apple2e } from './emulator/apple2e';

// ── Starfield Background ────────────────────────────────────
function initStarfield() {
  const c = document.getElementById('starfield') as HTMLCanvasElement;
  if (!c) return;
  const ctx = c.getContext('2d')!;
  const stars: { x: number; y: number; r: number; s: number }[] = [];
  const resize = () => { c.width = innerWidth; c.height = innerHeight; };
  resize();
  addEventListener('resize', resize);
  for (let i = 0; i < 200; i++) {
    stars.push({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      r: Math.random() * 1.5 + 0.3,
      s: Math.random() * 0.3 + 0.05,
    });
  }
  (function draw() {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const s of stars) {
      s.y += s.s;
      if (s.y > c.height) { s.y = 0; s.x = Math.random() * c.width; }
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,220,255,${0.3 + s.r * 0.3})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  })();
}

// ── Status Updater ──────────────────────────────────────────
function setStatus(msg: string) {
  const el = document.getElementById('load-status');
  if (el) el.textContent = msg;
}

// ── Load a .dsk file as Uint8Array ──────────────────────────
async function loadDisk(path: string): Promise<Uint8Array> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

// ── Simple Apple IIe Screen Renderer ────────────────────────
// Renders the 40x24 text screen from the emulator's memory
class ScreenRenderer {
  private ctx: CanvasRenderingContext2D;
  private imgData: ImageData;
  private charROM: Uint8Array;
  private colorMode: string = 'green';

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.imgData = this.ctx.createImageData(560, 384);
    // Generate a minimal character ROM (ASCII subset for text mode)
    this.charROM = this.generateCharROM();
  }

  setColorMode(mode: string) { this.colorMode = mode; }

  // Minimal 8x8 character generator for common ASCII
  private generateCharROM(): Uint8Array {
    const rom = new Uint8Array(256 * 8);
    // We'll generate basic glyphs for printable ASCII (0x20-0x7E)
    const glyphs: Record<number, number[]> = {
      0x20: [0,0,0,0,0,0,0,0], // space
      0x21: [0x08,0x08,0x08,0x08,0x08,0x00,0x08,0], // !
      0x27: [0x08,0x08,0x04,0,0,0,0,0], // '
      0x28: [0x04,0x08,0x10,0x10,0x10,0x08,0x04,0], // (
      0x29: [0x20,0x10,0x08,0x08,0x08,0x10,0x20,0], // )
      0x2B: [0,0x08,0x08,0x3E,0x08,0x08,0,0], // +
      0x2C: [0,0,0,0,0,0x08,0x08,0x10], // ,
      0x2D: [0,0,0,0x3E,0,0,0,0], // -
      0x2E: [0,0,0,0,0,0x18,0x18,0], // .
      0x2F: [0x02,0x04,0x08,0x10,0x20,0x40,0,0], // /
      0x30: [0x3C,0x42,0x46,0x4A,0x52,0x62,0x3C,0], // 0
      0x31: [0x08,0x18,0x28,0x08,0x08,0x08,0x3E,0], // 1
      0x32: [0x3C,0x42,0x02,0x0C,0x30,0x40,0x7E,0], // 2
      0x33: [0x3C,0x42,0x02,0x1C,0x02,0x42,0x3C,0], // 3
      0x34: [0x04,0x0C,0x14,0x24,0x7E,0x04,0x04,0], // 4
      0x35: [0x7E,0x40,0x7C,0x02,0x02,0x42,0x3C,0], // 5
      0x36: [0x1C,0x20,0x40,0x7C,0x42,0x42,0x3C,0], // 6
      0x37: [0x7E,0x02,0x04,0x08,0x10,0x10,0x10,0], // 7
      0x38: [0x3C,0x42,0x42,0x3C,0x42,0x42,0x3C,0], // 8
      0x39: [0x3C,0x42,0x42,0x3E,0x02,0x04,0x38,0], // 9
      0x3A: [0,0x18,0x18,0,0x18,0x18,0,0], // :
      0x3D: [0,0,0x7E,0,0x7E,0,0,0], // =
      0x3F: [0x3C,0x42,0x02,0x0C,0x08,0x00,0x08,0], // ?
      0x41: [0x18,0x24,0x42,0x7E,0x42,0x42,0x42,0], // A
      0x42: [0x7C,0x42,0x42,0x7C,0x42,0x42,0x7C,0], // B
      0x43: [0x3C,0x42,0x40,0x40,0x40,0x42,0x3C,0], // C
      0x44: [0x78,0x44,0x42,0x42,0x42,0x44,0x78,0], // D
      0x45: [0x7E,0x40,0x40,0x7C,0x40,0x40,0x7E,0], // E
      0x46: [0x7E,0x40,0x40,0x7C,0x40,0x40,0x40,0], // F
      0x47: [0x3C,0x42,0x40,0x4E,0x42,0x42,0x3C,0], // G
      0x48: [0x42,0x42,0x42,0x7E,0x42,0x42,0x42,0], // H
      0x49: [0x3E,0x08,0x08,0x08,0x08,0x08,0x3E,0], // I
      0x4A: [0x1E,0x04,0x04,0x04,0x04,0x44,0x38,0], // J
      0x4B: [0x42,0x44,0x48,0x70,0x48,0x44,0x42,0], // K
      0x4C: [0x40,0x40,0x40,0x40,0x40,0x40,0x7E,0], // L
      0x4D: [0x42,0x66,0x5A,0x42,0x42,0x42,0x42,0], // M
      0x4E: [0x42,0x62,0x52,0x4A,0x46,0x42,0x42,0], // N
      0x4F: [0x3C,0x42,0x42,0x42,0x42,0x42,0x3C,0], // O
      0x50: [0x7C,0x42,0x42,0x7C,0x40,0x40,0x40,0], // P
      0x51: [0x3C,0x42,0x42,0x42,0x4A,0x44,0x3A,0], // Q
      0x52: [0x7C,0x42,0x42,0x7C,0x48,0x44,0x42,0], // R
      0x53: [0x3C,0x42,0x40,0x3C,0x02,0x42,0x3C,0], // S
      0x54: [0x7F,0x08,0x08,0x08,0x08,0x08,0x08,0], // T
      0x55: [0x42,0x42,0x42,0x42,0x42,0x42,0x3C,0], // U
      0x56: [0x42,0x42,0x42,0x42,0x24,0x24,0x18,0], // V
      0x57: [0x42,0x42,0x42,0x5A,0x5A,0x66,0x42,0], // W
      0x58: [0x42,0x24,0x18,0x18,0x24,0x42,0x42,0], // X
      0x59: [0x41,0x22,0x14,0x08,0x08,0x08,0x08,0], // Y
      0x5A: [0x7E,0x02,0x04,0x08,0x10,0x20,0x7E,0], // Z
    };
    for (const [code, rows] of Object.entries(glyphs)) {
      const c = parseInt(code);
      for (let r = 0; r < 8; r++) rom[c * 8 + r] = rows[r];
    }
    return rom;
  }

  // Render 40x24 text page from memory
  renderTextPage(memory: Uint8Array) {
    const pixels = this.imgData.data;
    const [r, g, b] = this.getColor();

    // Apple II text screen memory is at $0400-$07FF with interleaved layout
    const baseAddrs = [
      0x400, 0x480, 0x500, 0x580, 0x600, 0x680, 0x700, 0x780,
      0x428, 0x4A8, 0x528, 0x5A8, 0x628, 0x6A8, 0x728, 0x7A8,
      0x450, 0x4D0, 0x550, 0x5D0, 0x650, 0x6D0, 0x750, 0x7D0,
    ];

    for (let row = 0; row < 24; row++) {
      const base = baseAddrs[row];
      for (let col = 0; col < 40; col++) {
        let ch = memory[base + col] & 0x7F;
        // Render 8x8 character scaled 2x to fill 560x384
        for (let py = 0; py < 8; py++) {
          const bits = this.charROM[ch * 8 + py] || 0;
          for (let px = 0; px < 7; px++) {
            const lit = (bits >> (6 - px)) & 1;
            // Each Apple II pixel = 2x2 screen pixels
            for (let dy = 0; dy < 2; dy++) {
              for (let dx = 0; dx < 2; dx++) {
                const sx = (col * 14) + (px * 2) + dx;
                const sy = (row * 16) + (py * 2) + dy;
                const idx = (sy * 560 + sx) * 4;
                pixels[idx] = lit ? r : 0;
                pixels[idx+1] = lit ? g : 0;
                pixels[idx+2] = lit ? b : 0;
                pixels[idx+3] = 255;
              }
            }
          }
        }
      }
    }
    this.ctx.putImageData(this.imgData, 0, 0);
  }

  // Render raw framebuffer (280x192, 1 byte per pixel color index)
  renderFramebuffer(fb: Uint8Array) {
    const pixels = this.imgData.data;
    for (let y = 0; y < 192; y++) {
      for (let x = 0; x < 280; x++) {
        const color = fb[y * 280 + x];
        const [r, g, b] = this.appleColor(color);
        // Scale 2x
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const idx = ((y*2+dy) * 560 + (x*2+dx)) * 4;
            pixels[idx] = r; pixels[idx+1] = g;
            pixels[idx+2] = b; pixels[idx+3] = 255;
          }
        }
      }
    }
    this.ctx.putImageData(this.imgData, 0, 0);
  }

  clear() {
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, 560, 384);
  }

  private getColor(): [number, number, number] {
    switch (this.colorMode) {
      case 'green': return [0, 255, 65];
      case 'amber': return [255, 176, 0];
      case 'white': return [220, 220, 220];
      default: return [0, 255, 65];
    }
  }

  private appleColor(idx: number): [number, number, number] {
    const palette: [number,number,number][] = [
      [0,0,0],[227,30,96],[63,55,169],[255,68,253],
      [0,135,40],[128,128,128],[38,151,255],[191,180,255],
      [100,76,0],[255,106,60],[128,128,128],[255,160,208],
      [20,245,60],[255,255,128],[96,217,248],[255,255,255],
    ];
    return palette[idx & 0xF] || [0,0,0];
  }
}

// ── Boot ─────────────────────────────────────────────────────
async function boot() {
  initStarfield();
  const screen = document.getElementById('screen') as HTMLCanvasElement;
  const overlay = document.getElementById('loading-overlay')!;
  const led = document.getElementById('drive-led')!;
  const renderer = new ScreenRenderer(screen);

  try {
    // Load both disk sides
    setStatus('Loading Side A…');
    const sideA = await loadDisk('/disks/pss_side_a.dsk');
    setStatus('Loading Side B…');
    const sideB = await loadDisk('/disks/pss_side_b.dsk');
    setStatus(`Disks loaded: ${sideA.length + sideB.length} bytes`);

    // Flash drive LED
    led.classList.add('active');
    setTimeout(() => led.classList.remove('active'), 1500);

    setStatus('Initializing Apple IIe…');

    // ── Create and configure emulator ──────────────────────
    const apple = new Apple2e();
    apple.loadDiskA(sideA);
    apple.loadDiskB(sideB);

    // Wire drive LED
    apple.onDriveLED = (on: boolean) => {
      if (on) led.classList.add('active');
      else led.classList.remove('active');
    };

    // Wire video output - render on each frame
    apple.onFrame = (memory: Uint8Array) => {
      if (apple.textMode) {
        renderer.renderTextPage(memory);
      }
      // TODO: Hi-res and Lo-res rendering
    };

    // Show initial status on screen before booting
    const textBase = [
      0x400, 0x480, 0x500, 0x580, 0x600, 0x680, 0x700, 0x780,
      0x428, 0x4A8, 0x528, 0x5A8, 0x628, 0x6A8, 0x728, 0x7A8,
      0x450, 0x4D0, 0x550, 0x5D0, 0x650, 0x6D0, 0x750, 0x7D0,
    ];
    function writeLine(row: number, text: string) {
      const base = textBase[row];
      const pad = Math.floor((40 - text.length) / 2);
      for (let i = 0; i < 40; i++) {
        const ch = i >= pad && i < pad + text.length
          ? text.charCodeAt(i - pad) : 0x20;
        apple.ram[base + i] = ch;
      }
    }
    for (let r = 0; r < 24; r++)
      for (let c = 0; c < 40; c++)
        apple.ram[textBase[r] + c] = 0x20;

    writeLine(4, 'PROJECT: SPACE STATION');
    writeLine(6, 'APPLE IIE EMULATOR');
    writeLine(9, 'SIDE A: ' + sideA.length + ' BYTES');
    writeLine(10, 'SIDE B: ' + sideB.length + ' BYTES');
    writeLine(12, 'CLOUDFLARE WORKERS EDGE');
    writeLine(15, '6502 CPU INITIALIZED');
    writeLine(16, 'DISK II CONTROLLER READY');
    writeLine(18, 'PRESS SPACE TO BOOT');
    writeLine(22, 'ESC FOR OPTIONS');

    renderer.renderTextPage(apple.ram);

    // Hide loading overlay
    await new Promise(r => setTimeout(r, 600));
    overlay.classList.add('hidden');

    // ── Keyboard handler ───────────────────────────────────
    let booted = false;
    document.addEventListener('keydown', (e) => {
      e.preventDefault();
      // Map browser key to Apple II key code
      let key = 0;
      if (e.key.length === 1) {
        key = e.key.toUpperCase().charCodeAt(0);
      } else switch (e.key) {
        case 'Enter': key = 0x0D; break;
        case 'Escape': key = 0x1B; break;
        case 'Backspace': key = 0x08; break;
        case 'ArrowLeft': key = 0x08; break;
        case 'ArrowRight': key = 0x15; break;
        case 'ArrowUp': key = 0x0B; break;
        case 'ArrowDown': key = 0x0A; break;
        case 'Tab': key = 0x09; break;
      }
      if (key) {
        apple.keyDown(key);
        if (!booted && e.key === ' ') {
          booted = true;
          setStatus('Booting from disk…');
          try { apple.start(); } catch(err) {
            console.error('[PSS] Boot error:', err);
          }
        }
      }
    });

    // ── Control buttons ────────────────────────────────────
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      apple.stop();
      booted = false;
      for (let r = 0; r < 24; r++)
        for (let c = 0; c < 40; c++)
          apple.ram[textBase[r] + c] = 0x20;
      writeLine(10, 'RESET - PRESS SPACE TO BOOT');
      renderer.renderTextPage(apple.ram);
    });

    let paused = false;
    document.getElementById('btn-pause')?.addEventListener('click', () => {
      paused = !paused;
      const btn = document.getElementById('btn-pause')!;
      if (paused) {
        apple.stop();
        btn.innerHTML = '<span class="btn-icon">▶</span> PLAY';
      } else {
        if (booted) apple.start();
        btn.innerHTML = '<span class="btn-icon">⏸</span> PAUSE';
      }
    });

    document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
      const monitor = document.getElementById('monitor')!;
      if (document.fullscreenElement) document.exitFullscreen();
      else monitor.requestFullscreen();
    });

    document.getElementById('color-select')?.addEventListener('change', (e) => {
      renderer.setColorMode((e.target as HTMLSelectElement).value);
      renderer.renderTextPage(apple.ram);
    });

    console.log('[PSS] Apple IIe emulator ready.');
    console.log('[PSS] Side A:', sideA.length, 'bytes, Side B:', sideB.length, 'bytes');
    console.log('[PSS] Press SPACE to boot from disk.');
  } catch (err) {
    setStatus(`ERROR: ${err}`);
    console.error('[PSS] Boot failed:', err);
  }
}

document.addEventListener('DOMContentLoaded', boot);
