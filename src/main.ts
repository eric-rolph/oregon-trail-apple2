/**
 * Project: Space Station — Main Entry Point
 * Embeds Apple2TS emulator to play the game, with our premium CRT UI wrapper.
 */

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

// ── Build the emulator URL ──────────────────────────────────
function getEmulatorURL(): string {
  // The disk images are served from our own Cloudflare Worker.
  // Apple2TS loads them via URL hash fragment.
  const origin = window.location.origin;
  const diskURL = `${origin}/disks/pss_side_a.dsk`;
  
  // Apple2TS parameters:
  //   machine=apple2ee  → Apple IIe Enhanced
  //   appmode=embed     → Minimal UI for embedding
  //   color=color       → Color display (user can change)
  //   speed=normal      → 1 MHz authentic speed
  const params = new URLSearchParams({
    machine: 'apple2ee',
    appmode: 'embed',
    color: 'color',
    speed: 'normal',
  });

  return `https://apple2ts.com/?${params.toString()}#${diskURL}`;
}

// ── Boot ─────────────────────────────────────────────────────
async function boot() {
  initStarfield();
  const overlay = document.getElementById('loading-overlay')!;
  const led = document.getElementById('drive-led')!;
  const emulatorFrame = document.getElementById('emulator-frame') as HTMLIFrameElement;
  const screen = document.getElementById('screen') as HTMLCanvasElement;

  try {
    // Verify disk images are accessible
    setStatus('Verifying disk images…');
    const checkA = await fetch('/disks/pss_side_a.dsk', { method: 'HEAD' });
    const checkB = await fetch('/disks/pss_side_b.dsk', { method: 'HEAD' });
    
    if (!checkA.ok || !checkB.ok) {
      throw new Error('Disk images not found on server');
    }
    
    setStatus('Disk images verified ✓');
    
    // Flash drive LED
    led.classList.add('active');
    
    setStatus('Loading Apple IIe emulator…');
    
    // Build the emulator URL and load it
    const emulatorURL = getEmulatorURL();
    console.log('[PSS] Emulator URL:', emulatorURL);
    
    // Show the iframe, hide the canvas placeholder
    screen.style.display = 'none';
    emulatorFrame.style.display = 'block';
    emulatorFrame.src = emulatorURL;
    
    // Wait for iframe to load
    emulatorFrame.addEventListener('load', () => {
      setStatus('Apple IIe booting from disk…');
      setTimeout(() => {
        overlay.classList.add('hidden');
        led.classList.remove('active');
      }, 1500);
    });
    
    // Timeout fallback — hide overlay after 8 seconds regardless
    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 8000);

    // ── Control buttons ────────────────────────────────────
    document.getElementById('btn-reset')?.addEventListener('click', () => {
      emulatorFrame.src = getEmulatorURL();
      led.classList.add('active');
      setTimeout(() => led.classList.remove('active'), 2000);
    });

    document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
      const monitor = document.querySelector('.monitor-inner') as HTMLElement;
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        monitor.requestFullscreen();
      }
    });

    // Color mode selector — rebuild URL with new color param
    document.getElementById('color-select')?.addEventListener('change', (e) => {
      const mode = (e.target as HTMLSelectElement).value;
      const colorMap: Record<string, string> = {
        'color': 'color',
        'green': 'green',
        'amber': 'amber',
        'white': 'white',
      };
      const origin = window.location.origin;
      const diskURL = `${origin}/disks/pss_side_a.dsk`;
      const params = new URLSearchParams({
        machine: 'apple2ee',
        appmode: 'embed',
        color: colorMap[mode] || 'color',
        speed: 'normal',
      });
      emulatorFrame.src = `https://apple2ts.com/?${params.toString()}#${diskURL}`;
    });

    // Speed selector
    document.getElementById('speed-select')?.addEventListener('change', (e) => {
      const speedVal = (e.target as HTMLSelectElement).value;
      const speedMap: Record<string, string> = {
        '1': 'normal',
        '2': 'two',
        '4': 'fast',
        '0': 'warp',
      };
      const origin = window.location.origin;
      const diskURL = `${origin}/disks/pss_side_a.dsk`;
      const params = new URLSearchParams({
        machine: 'apple2ee',
        appmode: 'embed',
        color: 'color',
        speed: speedMap[speedVal] || 'normal',
      });
      emulatorFrame.src = `https://apple2ts.com/?${params.toString()}#${diskURL}`;
    });

    // Focus the iframe when clicking the monitor area
    document.querySelector('.monitor-inner')?.addEventListener('click', () => {
      emulatorFrame.focus();
    });

    console.log('[PSS] Apple IIe emulator loaded via Apple2TS');
    console.log('[PSS] Disk A:', checkA.headers.get('content-length'), 'bytes');
    console.log('[PSS] Disk B:', checkB.headers.get('content-length'), 'bytes');

  } catch (err) {
    setStatus(`ERROR: ${err}`);
    console.error('[PSS] Boot failed:', err);
  }
}

document.addEventListener('DOMContentLoaded', boot);
