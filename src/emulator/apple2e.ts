/**
 * Apple IIe Hardware Emulation
 * Memory map, soft switches, video, keyboard, and Disk II controller.
 * Uses 6502-emulator package for CPU.
 */
import { CPU6502, ReadWrite } from '6502-emulator';

// ── Apple IIe ROM (minimal boot ROM) ──────────────────────────
// This is a minimal ROM that implements just enough to boot DOS 3.3
// from a disk. A full Apple IIe ROM would be 16KB at $C000-$FFFF.
function createBootROM(): Uint8Array {
  const rom = new Uint8Array(0x4000); // 16KB C000-FFFF

  // Reset vector points to $C600 (Disk II boot ROM in slot 6)
  rom[0x3FFC] = 0x00; // FFFC -> low byte
  rom[0x3FFD] = 0xC6; // FFFD -> high byte (C600)

  // IRQ/BRK vector
  rom[0x3FFE] = 0x00;
  rom[0x3FFF] = 0xFF;

  // NMI vector
  rom[0x3FFA] = 0x00;
  rom[0x3FFB] = 0xFF;

  // Minimal routines at FF00-FFFF area
  // FFFF: RTI (for interrupts)
  rom[0x3F00] = 0x40; // RTI

  // ── Disk II controller ROM at $C600-$C6FF ───────────────
  // This is a simplified boot ROM for slot 6 that reads T0S0
  // into $0800 and jumps to $0801
  const diskROM = [
    // $C600: Initialize and read Track 0, Sector 0 to $0800
    0xA2, 0x20,       // LDX #$20   ; timing
    0xA0, 0x00,       // LDY #$00   ; sector 0
    0xA9, 0x01,       // LDA #$01   ; read command
    0x85, 0x3D,       // STA $3D    ; store command
    0xA9, 0x00,       // LDA #$00
    0x85, 0x27,       // STA $27    ; track 0
    0xA9, 0x08,       // LDA #$08
    0x85, 0x26,       // STA $26    ; buffer page = $0800
    // We'll use a simplified disk read - directly copy from disk image
    // Jump to our custom disk read handler at $C640
    0x4C, 0x40, 0xC6, // JMP $C640
    // Padding
    0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA,
    0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA,
    0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA,
    0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA,
    0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA,
    0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA, 0xEA,
    // $C640: Simplified disk read handler
    // Reads 256 bytes from disk image offset 0 (T0S0) into $0800
    // Then jumps to $0801
    0xA0, 0x00,       // LDY #$00
    // Loop: read byte from disk I/O and store to buffer
    0xAD, 0x8C, 0xC0, // LDA $C08C  ; read data latch (slot 6)
    0x10, 0xFB,       // BPL $C643  ; wait for data ready (bit 7 set)
    0x99, 0x00, 0x08, // STA $0800,Y
    0xC8,             // INY
    0xD0, 0xF5,       // BNE $C643  ; loop 256 times
    0x4C, 0x01, 0x08, // JMP $0801  ; jump to loaded boot code
  ];

  for (let i = 0; i < diskROM.length && i < 256; i++) {
    rom[0x600 + i] = diskROM[i]; // $C600 = rom offset 0x600
  }

  // ── Keyboard / display routines (minimal) ──────────────
  // $FD0C: RDKEY - Read keyboard
  rom[0x3D0C] = 0xAD; // LDA $C000
  rom[0x3D0D] = 0x00;
  rom[0x3D0E] = 0xC0;
  rom[0x3D0F] = 0x10; // BPL $FD0C (wait for key)
  rom[0x3D10] = 0xFA;
  rom[0x3D11] = 0x8D; // STA $C010 (clear strobe)
  rom[0x3D12] = 0x10;
  rom[0x3D13] = 0xC0;
  rom[0x3D14] = 0x60; // RTS

  // $FDED: COUT - Output character (store to screen)
  rom[0x3DED] = 0x60; // RTS (placeholder)

  // $FB2F: INIT - Screen init
  rom[0x3B2F] = 0x60; // RTS

  // $FC58: HOME - Clear screen
  rom[0x3C58] = 0xA9; // LDA #$A0 (space)
  rom[0x3C59] = 0xA0;
  rom[0x3C5A] = 0xA0; // LDY #$00 (not needed, placeholder)
  rom[0x3C5B] = 0x00;
  rom[0x3C5C] = 0x60; // RTS

  return rom;
}

// ── DOS 3.3 Disk Layout ──────────────────────────────────────
// Standard .dsk file: 35 tracks × 16 sectors × 256 bytes = 143,360 bytes
// Sector interleave for DOS 3.3:
const DOS33_SECTOR_ORDER = [0,7,14,6,13,5,12,4,11,3,10,2,9,1,8,15];

function diskOffset(track: number, sector: number): number {
  return (track * 16 + DOS33_SECTOR_ORDER[sector]) * 256;
}

// ── Apple IIe Emulator ───────────────────────────────────────
export class Apple2e {
  cpu: CPU6502;
  ram: Uint8Array;          // 64KB main RAM
  auxRam: Uint8Array;       // 64KB aux RAM (IIe)
  rom: Uint8Array;          // 16KB ROM
  diskA: Uint8Array | null = null;
  diskB: Uint8Array | null = null;
  currentDisk: 'A' | 'B' = 'A';

  // Keyboard
  private keyData: number = 0;
  private keyStrobe: boolean = false;

  // Video state
  textMode: boolean = true;
  mixedMode: boolean = false;
  hiresMode: boolean = false;
  page2: boolean = false;

  // Disk II state
  private diskPhase: number = 0;
  private diskMotor: boolean = false;
  private diskReadMode: boolean = true;
  private diskByteIndex: number = 0;
  private diskTrack: number = 0;
  private diskNibbles: Uint8Array = new Uint8Array(0);

  // Drive LED callback
  onDriveLED?: (on: boolean) => void;
  // Frame callback
  onFrame?: (memory: Uint8Array) => void;

  private running = false;
  private cycleCount = 0;
  private frameTimer = 0;

  constructor() {
    this.ram = new Uint8Array(65536);
    this.auxRam = new Uint8Array(65536);
    this.rom = createBootROM();

    this.cpu = new CPU6502({
      accessMemory: (rw, addr, val) => {
        if (rw === ReadWrite.read) {
          return this.readMem(addr);
        } else {
          this.writeMem(addr, val ?? 0);
        }
      },
    });
  }

  loadDiskA(data: Uint8Array) {
    this.diskA = data;
    this.nibblizeDisk();
  }

  loadDiskB(data: Uint8Array) {
    this.diskB = data;
  }

  // Convert current disk to nibble format for the disk controller
  private nibblizeDisk() {
    const disk = this.currentDisk === 'A' ? this.diskA : this.diskB;
    if (!disk) return;
    // Create nibblized track data (simplified - direct byte access)
    // For a real implementation, we'd do GCR 6-and-2 encoding
    this.diskNibbles = new Uint8Array(disk.length);
    this.diskNibbles.set(disk);
  }

  // ── Memory Read ────────────────────────────────────────────
  readMem(addr: number): number {
    addr &= 0xFFFF;

    // ROM space $C000-$FFFF
    if (addr >= 0xC000) {
      // Soft switches $C000-$C0FF
      if (addr >= 0xC000 && addr <= 0xC0FF) {
        return this.readSoftSwitch(addr);
      }
      // Slot ROMs $C100-$C7FF
      if (addr >= 0xC600 && addr <= 0xC6FF) {
        return this.rom[addr - 0xC000];
      }
      // Main ROM $D000-$FFFF
      if (addr >= 0xD000) {
        return this.rom[addr - 0xC000];
      }
      return this.rom[addr - 0xC000] || 0;
    }

    return this.ram[addr];
  }

  // ── Memory Write ───────────────────────────────────────────
  writeMem(addr: number, val: number) {
    addr &= 0xFFFF;

    // Soft switches
    if (addr >= 0xC000 && addr <= 0xC0FF) {
      this.writeSoftSwitch(addr, val);
      return;
    }

    // Don't write to ROM
    if (addr >= 0xC000) return;

    this.ram[addr] = val & 0xFF;
  }

  // ── Soft Switch Handling ───────────────────────────────────
  private readSoftSwitch(addr: number): number {
    switch (addr) {
      // Keyboard
      case 0xC000: return this.keyData | (this.keyStrobe ? 0x80 : 0);
      case 0xC010: this.keyStrobe = false; return this.keyData & 0x7F;

      // Video switches (return status in bit 7)
      case 0xC050: this.textMode = false; return 0;      // GR
      case 0xC051: this.textMode = true; return 0;        // TEXT
      case 0xC052: this.mixedMode = false; return 0;      // FULL
      case 0xC053: this.mixedMode = true; return 0;       // MIXED
      case 0xC054: this.page2 = false; return 0;          // PAGE1
      case 0xC055: this.page2 = true; return 0;           // PAGE2
      case 0xC056: this.hiresMode = false; return 0;      // LORES
      case 0xC057: this.hiresMode = true; return 0;       // HIRES

      // Disk II (slot 6: $C0E0-$C0EF)
      case 0xC0E0: case 0xC0E1: case 0xC0E2: case 0xC0E3:
      case 0xC0E4: case 0xC0E5: case 0xC0E6: case 0xC0E7:
        this.handleDiskPhase(addr);
        return 0;
      case 0xC0E8: // Motor off
        this.diskMotor = false;
        this.onDriveLED?.(false);
        return 0;
      case 0xC0E9: // Motor on
        this.diskMotor = true;
        this.onDriveLED?.(true);
        return 0;
      case 0xC0EA: // Select drive 1
        this.currentDisk = 'A';
        this.nibblizeDisk();
        return 0;
      case 0xC0EB: // Select drive 2
        this.currentDisk = 'B';
        this.nibblizeDisk();
        return 0;
      case 0xC0EC: // Read data / shift register
        return this.readDiskByte();
      case 0xC0ED: // Write data latch
        return 0;
      case 0xC0EE: // Read mode
        this.diskReadMode = true;
        return 0;
      case 0xC0EF: // Write mode
        this.diskReadMode = false;
        return 0;

      default: return 0;
    }
  }

  private writeSoftSwitch(addr: number, _val: number) {
    // Many soft switches are triggered by read OR write
    this.readSoftSwitch(addr);
  }

  // ── Disk II Phase Stepper ──────────────────────────────────
  private handleDiskPhase(addr: number) {
    const phase = (addr - 0xC0E0) >> 1;
    const on = (addr - 0xC0E0) & 1;
    if (on) {
      const diff = ((phase - this.diskPhase) + 4) % 4;
      if (diff === 1) {
        this.diskTrack = Math.min(34, this.diskTrack + 0.5);
      } else if (diff === 3) {
        this.diskTrack = Math.max(0, this.diskTrack - 0.5);
      }
      this.diskPhase = phase;
    }
  }

  // ── Disk Byte Read ─────────────────────────────────────────
  private readDiskByte(): number {
    const disk = this.currentDisk === 'A' ? this.diskA : this.diskB;
    if (!disk || !this.diskMotor) return 0;

    const track = Math.round(this.diskTrack);
    const trackOffset = track * 16 * 256;
    const byteIndex = this.diskByteIndex % (16 * 256);
    this.diskByteIndex = (this.diskByteIndex + 1) % (16 * 256);

    const offset = trackOffset + byteIndex;
    if (offset < disk.length) {
      return disk[offset] | 0x80; // Set high bit (data ready)
    }
    return 0;
  }

  // ── Keyboard Input ─────────────────────────────────────────
  keyDown(key: number) {
    this.keyData = key & 0x7F;
    this.keyStrobe = true;
  }

  // ── Run Loop ───────────────────────────────────────────────
  start() {
    if (this.running) return;
    this.running = true;
    this.cpu.reset();
    this.gameLoop();
  }

  stop() {
    this.running = false;
    if (this.frameTimer) cancelAnimationFrame(this.frameTimer);
  }

  private gameLoop = () => {
    if (!this.running) return;

    // Execute ~17,030 cycles per frame (1.023MHz / 60fps)
    const CYCLES_PER_FRAME = 17030;
    try {
      for (let i = 0; i < CYCLES_PER_FRAME; i++) {
        this.cpu.startClock();
        this.cycleCount++;
        // The 6502-emulator runs asynchronously via startClock,
        // so we just let it execute instructions
      }
    } catch (e) {
      console.error('[Apple2e] CPU error:', e);
    }

    // Trigger frame render
    this.onFrame?.(this.ram);

    this.frameTimer = requestAnimationFrame(this.gameLoop);
  };

  // ── Direct Memory Access (for debugging/display) ──────────
  getVideoMemory(): Uint8Array {
    if (this.textMode) {
      const base = this.page2 ? 0x0800 : 0x0400;
      return this.ram.slice(base, base + 0x400);
    }
    if (this.hiresMode) {
      const base = this.page2 ? 0x4000 : 0x2000;
      return this.ram.slice(base, base + 0x2000);
    }
    // Lores
    const base = this.page2 ? 0x0800 : 0x0400;
    return this.ram.slice(base, base + 0x400);
  }
}
