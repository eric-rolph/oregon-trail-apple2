/**
 * Project: Space Station — Main Entry Point
 * Embeds Apple2TS emulator to play the game, with our premium CRT UI wrapper.
 */

// ── Prairie Background ────────────────────────────────────
function initPrairie() {
  const c = document.getElementById('starfield') as HTMLCanvasElement;
  if (!c) return;
  const ctx = c.getContext('2d')!;
  const resize = () => { c.width = innerWidth; c.height = innerHeight; };
  resize();
  addEventListener('resize', resize);
  
  // Draw a simple static prairie landscape
  ctx.fillStyle = '#87CEEB'; // Sky blue
  ctx.fillRect(0, 0, c.width, c.height * 0.6);
  
  ctx.fillStyle = '#8B4513'; // Saddle brown mountains
  ctx.beginPath();
  ctx.moveTo(0, c.height * 0.6);
  ctx.lineTo(c.width * 0.2, c.height * 0.4);
  ctx.lineTo(c.width * 0.5, c.height * 0.6);
  ctx.lineTo(c.width * 0.8, c.height * 0.3);
  ctx.lineTo(c.width, c.height * 0.6);
  ctx.fill();

  ctx.fillStyle = '#2E8B57'; // Sea green grass
  ctx.fillRect(0, c.height * 0.6, c.width, c.height * 0.4);
}

// ── Status Updater ──────────────────────────────────────────
function setStatus(msg: string) {
  const el = document.getElementById('load-status');
  if (el) el.textContent = msg;
}

// ── Build the emulator URL ──────────────────────────────────
function getEmulatorURL(color = 'color', speed = 'normal'): string {
  const origin = window.location.origin;
  const diskURL = `${origin}/disks/oregon_trail.dsk`;
  
  const params = new URLSearchParams({
    machine: 'apple2ee',
    appmode: 'embed',
    color: color,
    speed: speed,
  });
  return `/emulator/index.html?${params.toString()}#${encodeURI(diskURL)}`;
}

// ── Boot ─────────────────────────────────────────────────────
async function boot() {
  initPrairie();
  const overlay = document.getElementById('loading-overlay')!;
  const led = document.getElementById('drive-led')!;
  const emulatorFrame = document.getElementById('emulator-frame') as HTMLIFrameElement;
  const screen = document.getElementById('screen') as HTMLCanvasElement;

  try {
    // Verify disk images are accessible
    setStatus('Verifying disk images…');
    const checkA = await fetch('/disks/oregon_trail.woz', { method: 'HEAD' });
    
    if (!checkA.ok) {
      throw new Error('Disk image not found on server');
    }
    
    setStatus('Disk images verified ✓');
    
    // Flash drive LED
    led.classList.add('active');
    
    setStatus('Loading Apple IIe emulator…');
    
    // Build the emulator URL and load it
    const emulatorURL = getEmulatorURL();
    console.log('[OregonTrail] Emulator URL:', emulatorURL);
    
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

    // Removed Side B logic

    document.getElementById('btn-save')?.addEventListener('click', () => {
      if (emulatorFrame.contentWindow) {
        emulatorFrame.contentWindow.postMessage({ type: 'saveState' }, window.location.origin);
        setStatus('Saving Game State...');
        led.classList.add('active');
        setTimeout(() => led.classList.remove('active'), 500);
      }
    });

    const fileInput = document.getElementById('load-file-input') as HTMLInputElement;
    document.getElementById('btn-load')?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && emulatorFrame.contentWindow) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const buffer = event.target?.result as ArrayBuffer;
          const dataArray = Array.from(new Uint8Array(buffer));
          emulatorFrame.contentWindow!.postMessage({
            type: 'loadState',
            filename: file.name,
            data: dataArray
          }, window.location.origin);
          setStatus('Game State Loaded');
          led.classList.add('active');
          setTimeout(() => led.classList.remove('active'), 500);
        };
        reader.readAsArrayBuffer(file);
      }
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
      
      const speedSelect = document.getElementById('speed-select') as HTMLSelectElement;
      const speedMap: Record<string, string> = {
        '1': 'normal',
        '2': 'two',
        '4': 'fast',
        '0': 'warp',
      };
      const speedVal = speedSelect ? speedMap[speedSelect.value] : 'normal';
      
      emulatorFrame.src = getEmulatorURL(colorMap[mode] || 'color', speedVal || 'normal');
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
      
      const colorSelect = document.getElementById('color-select') as HTMLSelectElement;
      const colorMap: Record<string, string> = {
        'color': 'color',
        'green': 'green',
        'amber': 'amber',
        'white': 'white',
      };
      const colorVal = colorSelect ? colorMap[colorSelect.value] : 'color';

      emulatorFrame.src = getEmulatorURL(colorVal || 'color', speedMap[speedVal] || 'normal');
    });

    // Focus the iframe when clicking the monitor area
    document.querySelector('.monitor-inner')?.addEventListener('click', () => {
      emulatorFrame.focus();
    });

    console.log('[OregonTrail] Apple IIe emulator loaded via Apple2TS');
    console.log('[OregonTrail] Disk:', checkA.headers.get('content-length'), 'bytes');

  } catch (err) {
    setStatus(`ERROR: ${err}`);
    console.error('[OregonTrail] Boot failed:', err);
  }
}

document.addEventListener('DOMContentLoaded', boot);
