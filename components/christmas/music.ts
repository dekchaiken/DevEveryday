// เพลงคลอคริสต์มาสแบบสร้างเสียงเองด้วย Web Audio (ไม่ใช้ไฟล์เพลงที่มีลิขสิทธิ์)
// เป็นคอร์ดคอร์ดอ่อน ๆ กับเสียงระฆังแบบสุ่มทำนองในสเกลเดียวกัน เสียงเบาและมีเสียงก้องเล็กน้อย
type Engine = { ctx: AudioContext; master: GainNode; timer: number; next: number; step: number };

let engine: Engine | null = null;

// คอร์ด I - vi - IV - V ในคีย์ C (เลขเป็นครึ่งเสียงจาก C4)
const CHORDS = [
  [60, 64, 67],
  [57, 60, 64],
  [53, 57, 60],
  [55, 59, 62],
];
const BPM = 76;
const EIGHTH = 60 / BPM / 2;
const STEPS_PER_BAR = 8;

function midiHz(n: number) {
  return 440 * Math.pow(2, (n - 69) / 12);
}

// ไฟก้องที่สร้างจากสัญญาณรบกวนที่ค่อย ๆ จาง
function makeImpulse(ctx: AudioContext) {
  const len = ctx.sampleRate * 2.6;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

function bell(e: Engine, freq: number, when: number, vel: number, reverb: GainNode) {
  const { ctx, master } = e;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(vel, when + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 2.6);
  g.connect(master);
  g.connect(reverb);
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.value = freq;
  o.connect(g);
  o.start(when);
  o.stop(when + 2.7);
  // โทนแหลมเล็กน้อยให้เสียงเหมือนระฆัง
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0, when);
  g2.gain.linearRampToValueAtTime(vel * 0.25, when + 0.008);
  g2.gain.exponentialRampToValueAtTime(0.0001, when + 0.9);
  g2.connect(g);
  const o2 = ctx.createOscillator();
  o2.type = "sine";
  o2.frequency.value = freq * 2.76;
  o2.connect(g2);
  o2.start(when);
  o2.stop(when + 1);
}

function pad(e: Engine, chord: number[], when: number, length: number, reverb: GainNode) {
  const { ctx, master } = e;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(0.028, when + 1.2);
  g.gain.linearRampToValueAtTime(0, when + length);
  g.connect(master);
  g.connect(reverb);
  for (const n of chord) {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = midiHz(n - 12);
    o.connect(g);
    o.start(when);
    o.stop(when + length + 0.1);
  }
}

// ตั้งเวลาโน้ตล่วงหน้าเป็นช่วง ๆ เพื่อให้จังหวะไม่สะดุดแม้เบราว์เซอร์ยุ่ง
function schedule(e: Engine) {
  const horizon = e.ctx.currentTime + 0.4;
  const reverb = reverbNode;
  if (!reverb) return;
  while (e.next < horizon) {
    const bar = Math.floor(e.step / STEPS_PER_BAR);
    const chord = CHORDS[bar % CHORDS.length];
    const pos = e.step % STEPS_PER_BAR;
    if (pos === 0) pad(e, chord, e.next, EIGHTH * STEPS_PER_BAR, reverb);
    // ทำนองสุ่มจากเสียงในคอร์ด เว้นจังหวะบ้างเพื่อให้ไม่ซ้ำ
    if (Math.random() < 0.55 || pos === 0) {
      const tone = chord[Math.floor(Math.random() * chord.length)];
      const octave = Math.random() < 0.35 ? 24 : 12;
      bell(e, midiHz(tone + octave), e.next, 0.05 + Math.random() * 0.04, reverb);
    }
    e.next += EIGHTH;
    e.step++;
  }
}

let reverbNode: GainNode | null = null;

export function isMusicPlaying() {
  return engine !== null;
}

// เริ่มเล่น ต้องเรียกจากการกดของผู้ใช้เท่านั้น (เบราว์เซอร์บังคับ)
export function startMusic() {
  if (engine) return;
  // สร้างเสียงได้เฉพาะตอนผู้ใช้เพิ่งแตะหรือกดคีย์ ไม่งั้นเบราว์เซอร์จะบล็อกและแจ้งเตือน
  const ua = (navigator as { userActivation?: { isActive: boolean } }).userActivation;
  if (ua && !ua.isActive) return;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0.0;
  master.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 2);
  master.connect(ctx.destination);
  const conv = ctx.createConvolver();
  conv.buffer = makeImpulse(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  conv.connect(wet);
  wet.connect(master);
  reverbNode = ctx.createGain();
  reverbNode.connect(conv);
  void ctx.resume();
  engine = { ctx, master, timer: 0, next: ctx.currentTime + 0.2, step: 0 };
  const e = engine;
  e.timer = window.setInterval(() => schedule(e), 120);
  schedule(e);
}

// หยุดแบบค่อย ๆ เบาลง
export function stopMusic() {
  const e = engine;
  if (!e) return;
  engine = null;
  window.clearInterval(e.timer);
  const t = e.ctx.currentTime;
  e.master.gain.cancelScheduledValues(t);
  e.master.gain.setValueAtTime(e.master.gain.value, t);
  e.master.gain.linearRampToValueAtTime(0, t + 0.6);
  window.setTimeout(() => e.ctx.close(), 800);
  reverbNode = null;
}
