const Sounds = {
  ctx: null,

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  },

  _tone(freq, dur, type, vol, endFreq) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (endFreq !== undefined) {
      osc.frequency.linearRampToValueAtTime(endFreq, this.ctx.currentTime + dur);
    }
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + dur);
  },

  send() {
    this._tone(440, 0.2, 'sine', 0.3, 880);
  },

  receive() {
    this._tone(880, 0.3, 'sine', 0.3, 1100);
  },

  error() {
    this._tone(180, 0.12, 'square', 0.2);
  },

  toggle() {
    this._tone(660, 0.08, 'sine', 0.2);
  }
};
