/* GameAudio — музыка и звуки «Последней станции».
   Треки (необязательно): audio/menu.mp3, audio/day.mp3, audio/night.mp3, audio/attack.mp3 — играются через Howler.js.
   Если файла нет или Howler не загрузился, то же состояние звучит на синтезе WebAudio.
   API: init(), playState('menu'|'day'|'night'|'attack'), updateAmbient({distToFire, distToGenerator}),
        growl(distance), setMusicVolume(0..1), setSfxVolume(0..1), settings {music, sfx}. */
(function () {
  'use strict';
  const LS = 'ls_audio';
  const load = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } };
  const saved = load();
  const A = {
    settings: { master: saved.master != null ? saved.master : 1, music: saved.music != null ? saved.music : 0.6, sfx: saved.sfx != null ? saved.sfx : 0.8 },
    state: null, ctx: null, ready: false, tracks: {}, synth: null
  };
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(A.settings)); } catch (e) {} };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- контекст и шины ---------- */
  function init() {
    if (A.ready) { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (window.Howler && Howler.ctx) A.ctx = Howler.ctx; else if (AC) A.ctx = new AC(); else return;
    if (A.ctx.state === 'suspended') A.ctx.resume();
    const c = A.ctx;
    A.master = c.createGain(); A.master.gain.value = A.settings.master; A.master.connect(c.destination);
    if (window.Howler) Howler.volume(A.settings.master);
    A.music = c.createGain(); A.music.gain.value = A.settings.music; A.music.connect(A.master);
    A.sfx = c.createGain(); A.sfx.gain.value = A.settings.sfx; A.sfx.connect(A.master);
    A.noise = makeNoise(c);
    // фоновый шум (ветер, треск, гул) отключён по просьбе игрока
    A.ready = true;
    if (A.pending) { const s = A.pending; A.pending = null; A.state = null; playState(s); }
  }
  function makeNoise(c) {
    const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  const noiseSrc = () => { const n = A.ctx.createBufferSource(); n.buffer = A.noise; n.loop = true; return n; };
  const ramp = (p, v, t = 1.5) => { const n = A.ctx.currentTime; p.cancelScheduledValues(n); p.setValueAtTime(p.value, n); p.linearRampToValueAtTime(v, n + t); };

  /* ---------- окружение: ветер, треск огня, гул печи (шина эффектов) ---------- */
  function buildAmbient() {
    const c = A.ctx;
    // ветер: шум через полосовой фильтр с медленно плавающей частотой
    const wn = noiseSrc(), wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = 0.6;
    A.windG = c.createGain(); A.windG.gain.value = 0.0;
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 250; lfo.connect(lg); lg.connect(wf.frequency);
    wn.connect(wf); wf.connect(A.windG); A.windG.connect(A.sfx); wn.start(); lfo.start();
    // треск огня: короткие щелчки шума
    A.fireG = c.createGain(); A.fireG.gain.value = 0; A.fireG.connect(A.sfx);
    const fn = noiseSrc(), ff = c.createBiquadFilter(); ff.type = 'highpass'; ff.frequency.value = 1800;
    A.crackle = c.createGain(); A.crackle.gain.value = 0; fn.connect(ff); ff.connect(A.crackle); A.crackle.connect(A.fireG); fn.start();
    const rumble = noiseSrc(), rf = c.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 180; const rg = c.createGain(); rg.gain.value = 0.35;
    rumble.connect(rf); rf.connect(rg); rg.connect(A.fireG); rumble.start();
    const tick = () => { if (!A.ctx) return; const t = A.ctx.currentTime; const k = 0.5 + Math.random();
      A.crackle.gain.setValueAtTime(0, t); A.crackle.gain.linearRampToValueAtTime(0.6 * k, t + 0.004); A.crackle.gain.exponentialRampToValueAtTime(0.001, t + 0.05 + Math.random() * 0.06);
      setTimeout(tick, 40 + Math.random() * 260); };
    tick();
    // гул печи: низкая пила + вторая гармоника через фильтр
    A.genG = c.createGain(); A.genG.gain.value = 0; A.genG.connect(A.sfx);
    const g1 = c.createOscillator(), g2 = c.createOscillator(), gf = c.createBiquadFilter();
    g1.type = 'sawtooth'; g1.frequency.value = 49; g2.type = 'square'; g2.frequency.value = 98.5; gf.type = 'lowpass'; gf.frequency.value = 220;
    const g2g = c.createGain(); g2g.gain.value = 0.25; g1.connect(gf); g2.connect(g2g); g2g.connect(gf); gf.connect(A.genG); g1.start(); g2.start();
  }
  function updateAmbient(o) {
    if (!A.ready || !A.windG) return;
    const df = o && o.distToFire != null ? o.distToFire : 20, dg = o && o.distToGenerator != null ? o.distToGenerator : 99;
    ramp(A.fireG.gain, clamp(0.5 / (1 + df * df * 0.08), 0, 0.5), 0.2);
    ramp(A.genG.gain, clamp(0.18 / (1 + dg * dg * 0.06), 0, 0.18), 0.2);
    ramp(A.windG.gain, clamp(0.05 + df * 0.012, 0.05, 0.28), 0.4);
  }

  /* ---------- музыка: трек через Howler или синтез ---------- */
  // плавная смена громкости трека (свой таймер: fade() Howler в html5-режиме ненадёжен)
  function vramp(h, id, to, ms, done) {
    clearInterval(h._vr); const from = +h.volume(id) || 0, t0 = Date.now();
    h._vr = setInterval(() => { const k = Math.min(1, (Date.now() - t0) / ms); h.volume(from + (to - from) * k, id); if (k >= 1) { clearInterval(h._vr); done && done(); } }, 50);
  }
  function playState(st) {
    if (st === A.state) return;
    if (!A.ready) { A.pending = st; return; }
    A.state = st;
    stopMusic();
    if (window.Howl && A.tracks[st] !== false) {
      let h = A.tracks[st];
      if (!h) {
        h = A.tracks[st] = new Howl({ src: ['audio/' + st + '.mp3', 'audio/' + st + '.ogg'], loop: true, volume: 0, html5: true, preload: true,
          onloaderror: () => { A.tracks[st] = false; if (A.state === st && !A.synth) startSynth(st); } });
      }
      const start = () => { // ровно один экземпляр трека на состояние
        if (A.state !== st || A.cur) return;
        stopSynth();
        // у трека один экземпляр: продолжаем его, а не создаём новый; лишние гасим
        if (h._gid == null) h._gid = h.play(); else h.play(h._gid);
        const id = h._gid; h._sounds.forEach(sn => { if (sn._id !== id && !sn._paused) h.stop(sn._id); });
        clearTimeout(h._pt); h.volume(0, id); vramp(h, id, A.settings.music, 2500); A.cur = { h, id };
      };
      if (h.state() === 'loaded') start();
      else { startSynth(st); h.once('load', start); }
      return;
    }
    startSynth(st);
  }
  function stopMusic() {
    if (A.cur) { const { h, id } = A.cur; A.cur = null;
      vramp(h, id, 0, 1500, () => { if (!A.cur || A.cur.h !== h) h.pause(id); }); }
    stopSynth();
  }
  function stopSynth() {
    const s = A.synth; if (!s) return; A.synth = null;
    ramp(s.out.gain, 0, 2); s.stopped = true;
    setTimeout(() => { s.nodes.forEach(n => { try { n.stop(); } catch (e) {} }); try { s.out.disconnect(); } catch (e) {} }, 2200);
  }
  const N = f => 440 * Math.pow(2, (f - 69) / 12);
  function startSynth(st) {
    const c = A.ctx, out = c.createGain(); out.gain.value = 0; out.connect(A.music);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.connect(out);
    const s = { out, nodes: [], stopped: false }; A.synth = s;
    const pad = (notes, type, det, vol) => notes.forEach(m => [-det, det].forEach(d => {
      const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = N(m); o.detune.value = d; g.gain.value = vol;
      o.connect(g); g.connect(lp); o.start(); s.nodes.push(o); }));
    const lfo = (param, f, amt, base) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; g.gain.value = amt; param.value = base; o.connect(g); g.connect(param); o.start(); s.nodes.push(o); };
    const hit = (freq, dur, vol, type = 'sine', drop = 0.5) => { if (s.stopped) return; const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * drop, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05); };
    const metal = (vol) => { if (s.stopped) return; const t = c.currentTime, n = noiseSrc(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.frequency.value = 2400 + Math.random() * 1500; f.Q.value = 8; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + 0.4); };
    const pluck = (m, vol) => hit(N(m), 2.5, vol, 'triangle', 0.995);
    const loop = (fn, ms) => { const step = () => { if (s.stopped) return; fn(); setTimeout(step, typeof ms === 'function' ? ms() : ms); }; step(); };
    if (st === 'menu') { // тёмный медленный пэд, ля минор
      pad([45, 48, 52], 'sawtooth', 7, 0.035); lfo(lp.frequency, 0.05, 250, 650);
      loop(() => pluck([57, 60, 64, 67][(Math.random() * 4) | 0], 0.05), () => 4000 + Math.random() * 5000);
    } else if (st === 'day') { // ровный гул, редкие ноты, холод
      pad([33, 40], 'sawtooth', 5, 0.03); pad([57], 'sine', 3, 0.015); lfo(lp.frequency, 0.03, 150, 500);
      loop(() => pluck([64, 67, 69, 72, 76][(Math.random() * 5) | 0], 0.035), () => 6000 + Math.random() * 6000);
    } else if (st === 'night') { // темнее, сердцебиение
      pad([28, 35], 'sawtooth', 9, 0.035); lfo(lp.frequency, 0.04, 120, 330);
      loop(() => { hit(55, 0.25, 0.22); setTimeout(() => hit(50, 0.22, 0.15), 260); }, 1300);
    } else if (st === 'attack') { // ударные и диссонанс
      pad([40, 41, 47], 'sawtooth', 12, 0.03); lfo(lp.frequency, 0.5, 600, 1200);
      let b = 0; loop(() => { hit(80, 0.3, 0.45, 'sine', 0.35); if (b % 2) metal(0.12); if (b % 4 === 3) hit(46, 0.5, 0.25, 'square', 0.6); b++; }, 600);
    }
    ramp(out.gain, 1, 3);
  }

  /* ---------- рык мутанта ---------- */
  function growl(distance) {
    if (!A.ready) return;
    const c = A.ctx, t = c.currentTime, d = distance == null ? 5 : distance, vol = clamp(0.6 / (1 + d * d * 0.05), 0.02, 0.6);
    const o = c.createOscillator(), o2 = c.createOscillator(), n = noiseSrc(), f = c.createBiquadFilter(), g = c.createGain(), am = c.createOscillator(), amg = c.createGain();
    o.type = 'sawtooth'; o2.type = 'sawtooth'; const base = 70 + Math.random() * 40;
    o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * 0.7, t + 1.1); o2.frequency.value = base * 1.51;
    f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(300, t + 1.2); f.Q.value = 5;
    am.frequency.value = 22 + Math.random() * 10; amg.gain.value = vol * 0.5; am.connect(amg); amg.connect(g.gain);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.15); g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    const ng = c.createGain(); ng.gain.value = 0.4;
    o.connect(f); o2.connect(f); n.connect(ng); ng.connect(f); f.connect(g); g.connect(A.sfx);
    [o, o2, n, am].forEach(x => { x.start(t); x.stop(t + 1.4); });
  }

  /* ---------- смерть жителя: похоронный удар с тритоном и стоном ---------- */
  function death(n) {
    if (!A.ready) return;
    const c = A.ctx, t = c.currentTime, k = clamp(0.55 + 0.12 * Math.min(4, (n || 1) - 1), 0.5, 1), dur = 2.6 + Math.min(3, (n || 1)) * 0.4;
    const g = c.createGain(); g.gain.value = 0.0001; g.connect(A.sfx);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * k, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    // колокол: неровные обертона + тритон (диссонанс)
    [[98, 1], [98 * 1.414, 0.7], [98 * 2.76, 0.35], [98 * 4.1, 0.2], [92, 0.6]].forEach(([f, a]) => {
      const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.value = f; og.gain.value = a; o.connect(og); og.connect(g); o.start(t); o.stop(t + dur); });
    // глухой удар
    const n0 = noiseSrc(), nf = c.createBiquadFilter(), ng = c.createGain(); nf.type = 'lowpass'; nf.frequency.value = 300;
    ng.gain.setValueAtTime(0.6 * k, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.35); n0.connect(nf); nf.connect(ng); ng.connect(A.sfx); n0.start(t); n0.stop(t + 0.4);
    // нисходящий стон
    const o = c.createOscillator(), f = c.createBiquadFilter(), sg = c.createGain(), vib = c.createOscillator(), vg = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t + 0.25); o.frequency.exponentialRampToValueAtTime(110, t + 2.2);
    vib.frequency.value = 5.5; vg.gain.value = 6; vib.connect(vg); vg.connect(o.frequency);
    f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 3;
    sg.gain.setValueAtTime(0.0001, t + 0.2); sg.gain.linearRampToValueAtTime(0.18 * k, t + 0.6); sg.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
    o.connect(f); f.connect(sg); sg.connect(A.sfx); [o, vib].forEach(x => { x.start(t + 0.2); x.stop(t + 2.5); });
  }

  function setMusicVolume(v) { A.settings.music = clamp(+v, 0, 1); save(); if (A.music) ramp(A.music.gain, A.settings.music, 0.1); if (A.cur) { clearInterval(A.cur.h._vr); A.cur.h.volume(A.settings.music, A.cur.id); } }
  function setMasterVolume(v) { A.settings.master = clamp(+v, 0, 1); save(); if (A.master) ramp(A.master.gain, A.settings.master, 0.1); if (window.Howler) Howler.volume(A.settings.master); }
  function setSfxVolume(v) { A.settings.sfx = clamp(+v, 0, 1); save(); if (A.sfx) ramp(A.sfx.gain, A.settings.sfx, 0.1); }

  window.GameAudio = { init, playState, updateAmbient, growl, death, setMasterVolume, setMusicVolume, setSfxVolume, settings: A.settings, _a: A };
})();
