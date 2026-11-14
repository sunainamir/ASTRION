class SoundEngine {
  private ctx: AudioContext | null = null;
  private thrusterGain: GainNode | null = null;
  private thrusterOsc: OscillatorNode | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setEngineThrust(active: boolean, intensity = 0.5, muted = false) {
    if (muted || !active) {
      if (this.thrusterGain && this.ctx) {
        this.thrusterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
      }
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    if (!this.thrusterOsc || !this.thrusterGain) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.value = 46;

      filter.type = "lowpass";
      filter.frequency.value = 180;

      gain.gain.value = 0;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      this.thrusterOsc = osc;
      this.thrusterGain = gain;
    }

    const targetGain = Math.min(0.11, 0.03 + intensity * 0.08);
    this.thrusterGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.15);
    this.thrusterOsc.frequency.setTargetAtTime(
      42 + intensity * 26,
      ctx.currentTime,
      0.15
    );
  }

  public playTone(
    freq: number,
    duration = 0.14,
    type: OscillatorType = "sine",
    volume = 0.08,
    muted = false
  ) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  public playCountdownBeep(finalBeep = false, muted = false) {
    this.playTone(finalBeep ? 880 : 520, finalBeep ? 0.35 : 0.12, "triangle", 0.07, muted);
  }

  public playImpact(muted = false) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(110, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(32, ctx.currentTime + 0.32);

    gain.gain.setValueAtTime(0.16, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.34);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }

  public playShutter(muted = false) {
    if (muted) return;
    this.playTone(1450, 0.04, "square", 0.06, false);
    window.setTimeout(() => {
      this.playTone(980, 0.05, "triangle", 0.05, false);
    }, 55);
  }

  public playDiscovery(muted = false) {
    if (muted) return;
    this.playTone(587.33, 0.12, "sine", 0.08, false);
    window.setTimeout(() => this.playTone(880, 0.18, "sine", 0.08, false), 90);
  }

  public playTouchdown(muted = false) {
    if (muted) return;
    this.playTone(220, 0.25, "triangle", 0.09, false);
    window.setTimeout(() => this.playTone(440, 0.3, "sine", 0.08, false), 140);
  }
}

export const soundEngine = new SoundEngine();
