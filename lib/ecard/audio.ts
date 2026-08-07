// ======================================================================
// ALGORITHMIC WEB AUDIO ENGINE (no external asset dependencies)
// AudioContext is created lazily on the first user interaction only.
// ======================================================================

class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private drone: { osc: OscillatorNode; gain: GainNode } | null = null
  private heart: { interval: number | null; bpm: number } = { interval: null, bpm: 70 }
  private prisonHum: { osc: OscillatorNode; gain: GainNode } | null = null
  private muted = false

  /** Must be called from within a user gesture handler. */
  ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const AC =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.7
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05)
    }
    if (this.trackEl) this.trackEl.volume = m ? 0 : 0.55
  }

  isMuted() {
    return this.muted
  }

  // ---- Ambient 50Hz drone -------------------------------------------------
  startDrone() {
    const ctx = this.ensure()
    if (!ctx || !this.master || this.drone) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.value = 50
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.12
    lfoGain.gain.value = 6
    lfo.connect(lfoGain).connect(osc.frequency)
    gain.gain.value = 0.06
    osc.connect(gain).connect(this.master)
    osc.start()
    lfo.start()
    this.drone = { osc, gain }
  }

  stopDrone() {
    if (!this.ctx || !this.drone) return
    const { osc, gain } = this.drone
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3)
    osc.stop(this.ctx.currentTime + 1)
    this.drone = null
  }

  // ---- Heartbeat ----------------------------------------------------------
  setHeartRate(bpm: number) {
    this.heart.bpm = bpm
    const ctx = this.ensure()
    if (!ctx) return
    if (this.heart.interval) window.clearInterval(this.heart.interval)
    const period = Math.max(180, (60 / bpm) * 1000)
    this.heart.interval = window.setInterval(() => this.thump(), period)
  }

  stopHeart() {
    if (this.heart.interval) window.clearInterval(this.heart.interval)
    this.heart.interval = null
  }

  private thump() {
    const ctx = this.ctx
    if (!ctx || !this.master || this.muted) return
    const t = ctx.currentTime
    const beat = (offset: number, freq: number) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t + offset)
      osc.frequency.exponentialRampToValueAtTime(40, t + offset + 0.16)
      g.gain.setValueAtTime(0.0001, t + offset)
      g.gain.exponentialRampToValueAtTime(0.5, t + offset + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.2)
      osc.connect(g).connect(this.master as GainNode)
      osc.start(t + offset)
      osc.stop(t + offset + 0.25)
    }
    beat(0, 90)
    beat(0.16, 70) // lub-dub
  }

  // ---- One-shot UI/FX cues -----------------------------------------------
  private tone(freq: number, dur: number, type: OscillatorType, vol = 0.3) {
    const ctx = this.ensure()
    if (!ctx || !this.master || this.muted) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  click() {
    this.tone(320, 0.08, 'square', 0.18)
  }

  select() {
    this.tone(180, 0.14, 'triangle', 0.22)
  }

  reveal() {
    this.tone(440, 0.05, 'square', 0.2)
    window.setTimeout(() => this.tone(620, 0.12, 'square', 0.2), 60)
  }

  win() {
    this.tone(523, 0.12, 'triangle', 0.28)
    window.setTimeout(() => this.tone(784, 0.22, 'triangle', 0.28), 110)
  }

  lose() {
    this.tone(180, 0.2, 'sawtooth', 0.26)
    window.setTimeout(() => this.tone(90, 0.35, 'sawtooth', 0.26), 150)
  }

  // Mechanical drill: revving sawtooth that ramps up then hard-cuts within 1.5s.
  drill() {
    const ctx = this.ensure()
    if (!ctx || !this.master || this.muted) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(220, t)
    osc.frequency.linearRampToValueAtTime(520, t + 1.2)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.22, t + 0.1)
    g.gain.setValueAtTime(0.22, t + 1.2)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5) // steep ramp to silence
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + 1.55)
  }

  // Low-bass ring-modulated explosion, gain crushed to zero within 1.8s.
  explosion() {
    const ctx = this.ensure()
    if (!ctx || !this.master || this.muted) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator()
    const mod = ctx.createOscillator()
    const modGain = ctx.createGain()
    const g = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(70, t)
    osc.frequency.exponentialRampToValueAtTime(28, t + 1.2)
    mod.type = 'square'
    mod.frequency.value = 40
    modGain.gain.value = 30
    mod.connect(modGain).connect(osc.frequency)
    g.gain.setValueAtTime(0.6, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8)
    osc.connect(g).connect(this.master)
    osc.start(t)
    mod.start(t)
    osc.stop(t + 1.85)
    mod.stop(t + 1.85)
  }

  // ---- HP-loss impact cue: sharp gunshot-style crack + low thump ----------
  // Fires the instant either fighter loses HP. Synthesized (no external
  // asset): a tight noise transient through a snapping bandpass reads as a
  // "crack", layered over a short sub-bass thump for weight. Single hit,
  // not a loop — safe to fire every round without becoming grating.
  hitDamage(severe = false) {
    const ctx = this.ensure()
    if (!ctx || !this.master || this.muted) return
    const t = ctx.currentTime

    // Crack: filtered noise burst, very short and sharp
    const noise = ctx.createBufferSource()
    noise.buffer = this.makeNoiseBuffer(ctx)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = severe ? 1400 : 1900
    bp.Q.value = 0.7
    const crackGain = ctx.createGain()
    crackGain.gain.setValueAtTime(severe ? 0.55 : 0.4, t)
    crackGain.gain.exponentialRampToValueAtTime(0.0001, t + (severe ? 0.16 : 0.11))
    noise.connect(bp).connect(crackGain).connect(this.master)
    noise.start(t)
    noise.stop(t + 0.2)

    // Thump: fast pitch-drop sine for low-end punch
    const thump = ctx.createOscillator()
    const thumpGain = ctx.createGain()
    thump.type = 'sine'
    thump.frequency.setValueAtTime(severe ? 130 : 100, t)
    thump.frequency.exponentialRampToValueAtTime(35, t + 0.14)
    thumpGain.gain.setValueAtTime(severe ? 0.5 : 0.32, t)
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, t + (severe ? 0.3 : 0.2))
    thump.connect(thumpGain).connect(this.master)
    thump.start(t)
    thump.stop(t + 0.35)

    // Pained grunt on a severe (critical) hit only — short downward vocal-ish moan
    if (severe) {
      const g = ctx.createOscillator()
      const gg = ctx.createGain()
      g.type = 'sawtooth'
      g.frequency.setValueAtTime(220, t + 0.05)
      g.frequency.exponentialRampToValueAtTime(90, t + 0.32)
      const lp = ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 500
      gg.gain.setValueAtTime(0.0001, t + 0.05)
      gg.gain.exponentialRampToValueAtTime(0.22, t + 0.1)
      gg.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
      g.connect(lp).connect(gg).connect(this.master)
      g.start(t + 0.05)
      g.stop(t + 0.45)
    }
  }

  // ---- Prison steel-scrape hum loop --------------------------------------
  startPrisonHum() {
    const ctx = this.ensure()
    if (!ctx || !this.master || this.prisonHum) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.value = 62
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.type = 'sawtooth'
    lfo.frequency.value = 0.5
    lfoGain.gain.value = 18
    lfo.connect(lfoGain).connect(osc.frequency)
    gain.gain.value = 0.09
    osc.connect(gain).connect(this.master)
    osc.start()
    lfo.start()
    this.prisonHum = { osc, gain }
  }

  stopPrisonHum() {
    if (!this.ctx || !this.prisonHum) return
    const { osc, gain } = this.prisonHum
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2)
    osc.stop(this.ctx.currentTime + 0.6)
    this.prisonHum = null
  }

  // ---- Algorithmic hyperventilation (low-pass filtered white noise) ------
  private breath: {
    src: AudioBufferSourceNode
    filter: BiquadFilterNode
    gain: GainNode
    interval: number | null
    intensity: number
  } | null = null

  private makeNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1
    return buf
  }

  /** intensity 0..1 — higher = faster, more desperate gasping. */
  startBreathing(intensity = 0.3) {
    const ctx = this.ensure()
    if (!ctx || !this.master || this.breath) return
    const src = ctx.createBufferSource()
    src.buffer = this.makeNoiseBuffer(ctx)
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 700
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    src.connect(filter).connect(gain).connect(this.master)
    src.start()
    this.breath = { src, filter, gain, interval: null, intensity }
    this.scheduleBreathCycle()
  }

  private scheduleBreathCycle() {
    const ctx = this.ctx
    const b = this.breath
    if (!ctx || !b || !this.master) return
    const runCycle = () => {
      const cur = this.breath
      if (!ctx || !cur) return
      const t = ctx.currentTime
      const intensity = cur.intensity
      // faster + louder as intensity climbs
      const inhale = 0.4 - intensity * 0.18
      const exhale = 0.6 - intensity * 0.22
      const peakIn = this.muted ? 0.0001 : 0.1 + intensity * 0.28
      const peakOut = this.muted ? 0.0001 : 0.14 + intensity * 0.34
      cur.filter.frequency.setTargetAtTime(600 + intensity * 900, t, 0.1)
      // sharp exponential gasping inhale
      cur.gain.gain.cancelScheduledValues(t)
      cur.gain.gain.setValueAtTime(0.0001, t)
      cur.gain.gain.exponentialRampToValueAtTime(peakIn, t + inhale)
      cur.gain.gain.exponentialRampToValueAtTime(0.0001, t + inhale + 0.06)
      // heavy shuddering exhale
      cur.gain.gain.setValueAtTime(0.0001, t + inhale + 0.08)
      cur.gain.gain.exponentialRampToValueAtTime(peakOut, t + inhale + 0.08 + exhale * 0.5)
      cur.gain.gain.exponentialRampToValueAtTime(0.0001, t + inhale + 0.08 + exhale)
      const period = Math.max(500, (inhale + exhale + 0.2) * 1000)
      cur.interval = window.setTimeout(runCycle, period)
    }
    runCycle()
  }

  setBreathIntensity(intensity: number) {
    if (this.breath) this.breath.intensity = Math.max(0, Math.min(1, intensity))
  }

  stopBreathing() {
    const b = this.breath
    if (!b || !this.ctx) return
    if (b.interval) window.clearTimeout(b.interval)
    b.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15)
    try {
      b.src.stop(this.ctx.currentTime + 0.4)
    } catch {
      /* already stopped */
    }
    this.breath = null
  }

  /** One desperate post-victory burst that auto-stops after `seconds`. */
  breathingBurst(intensity = 0.7, seconds = 5) {
    this.stopBreathing()
    this.startBreathing(intensity)
    window.setTimeout(() => this.stopBreathing(), seconds * 1000)
  }

  // ---- Death bell: one somber toll for an execution/elimination moment ---
  // Struck-metal timbre via a fundamental + inharmonic partials, each with
  // its own slow exponential decay, layered with a soft sub thump for
  // weight. Single strike — safe to call once per elimination.
  deathBell() {
    const ctx = this.ensure()
    if (!ctx || !this.master || this.muted) return
    const t = ctx.currentTime
    const bus = ctx.createGain()
    bus.gain.value = 0.5
    bus.connect(this.master)

    // Inharmonic partials of a struck bell (not simple integer multiples).
    const partials: [number, number, number][] = [
      [180, 0.9, 3.2],
      [304, 0.5, 2.6],
      [412, 0.32, 2.1],
      [617, 0.18, 1.5],
      [890, 0.1, 0.9],
    ]
    partials.forEach(([freq, gain, decay]) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      g.gain.setValueAtTime(gain, t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
      osc.connect(g).connect(bus)
      osc.start(t)
      osc.stop(t + decay + 0.1)
    })

    // Low sub thump under the strike for extra gravity.
    const sub = ctx.createOscillator()
    const subGain = ctx.createGain()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(65, t)
    sub.frequency.exponentialRampToValueAtTime(30, t + 1.4)
    subGain.gain.setValueAtTime(0.4, t)
    subGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
    sub.connect(subGain).connect(bus)
    sub.start(t)
    sub.stop(t + 1.7)
  }

  // ---- Dirge: slow detuned choir-drone loop for lingering dread ----------
  private dirge: { oscs: OscillatorNode[]; gain: GainNode } | null = null

  startDirge() {
    const ctx = this.ensure()
    if (!ctx || !this.master || this.dirge) return
    const gain = ctx.createGain()
    gain.gain.value = 0.0001
    gain.connect(this.master)
    gain.gain.setTargetAtTime(0.05, ctx.currentTime, 1.2)

    // A close, slightly dissonant minor cluster, each voice with its own
    // slow vibrato so the chord never sits perfectly still.
    const freqs = [98, 116.5, 146.8, 174.6]
    const oscs = freqs.map((f) => {
      const osc = ctx.createOscillator()
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.value = f
      lfo.frequency.value = 0.06 + Math.random() * 0.05
      lfoGain.gain.value = 0.8
      lfo.connect(lfoGain).connect(osc.frequency)
      const voiceFilter = ctx.createBiquadFilter()
      voiceFilter.type = 'lowpass'
      voiceFilter.frequency.value = 500
      osc.connect(voiceFilter).connect(gain)
      osc.start()
      lfo.start()
      return osc
    })
    this.dirge = { oscs, gain }
  }

  stopDirge() {
    if (!this.ctx || !this.dirge) return
    const { oscs, gain } = this.dirge
    gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.6)
    oscs.forEach((o) => o.stop(this.ctx!.currentTime + 1.8))
    this.dirge = null
  }

  // ---- File-based tracks (mp3 stingers, e.g. match intro) ----------------
  private trackEl: HTMLAudioElement | null = null

  /** Plays an mp3/ogg from /public, replacing any track already playing. Respects mute. */
  playTrack(src: string, opts: { loop?: boolean; volume?: number; fadeOutAt?: number } = {}) {
    if (typeof window === 'undefined') return
    const { loop = false, volume = 0.55, fadeOutAt } = opts
    this.stopTrack()
    const el = new Audio(src)
    el.loop = loop
    el.volume = this.muted ? 0 : volume
    el.play().catch(() => {
      // Autoplay can be blocked if this wasn't triggered by a user gesture — safe to ignore.
    })
    this.trackEl = el
    if (fadeOutAt) window.setTimeout(() => this.fadeOutTrack(el), fadeOutAt)
  }

  private fadeOutTrack(el: HTMLAudioElement, duration = 900) {
    const steps = 18
    const startVol = el.volume
    let i = 0
    const iv = window.setInterval(() => {
      i += 1
      el.volume = Math.max(0, startVol * (1 - i / steps))
      if (i >= steps) {
        window.clearInterval(iv)
        el.pause()
      }
    }, duration / steps)
  }

  stopTrack() {
    if (this.trackEl) {
      this.trackEl.pause()
      this.trackEl = null
    }
  }

  /** Suspense stinger the instant a match kicks off (opening + duel tension cue). */
  playMatchIntroStinger() {
    this.playTrack('/audio/suspense-countdown.mp3', { loop: false, volume: 0.55, fadeOutAt: 7000 })
  }

  teardown() {
    this.stopHeart()
    this.stopDrone()
    this.stopPrisonHum()
    this.stopBreathing()
    this.stopDirge()
    this.stopTrack()
  }
}

// Singleton shared across the app.
export const audio = new AudioEngine()
