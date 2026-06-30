class CanvasInteraction {
  constructor(canvasAdapter, camera, onDraw) {
    this.canvas = canvasAdapter;
    this.camera = camera;
    this.onDraw = onDraw;
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._setup();
  }

  _setup() {
    this.canvas.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      this.camera.zoom(factor, mx, my);
      this.onDraw();
    }, { passive: false });

    this.canvas.canvas.addEventListener('mousedown', (e) => {
      this._dragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      this.canvas.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!this._dragging) return;
      this.camera.offsetX += e.clientX - this._lastX;
      this.camera.offsetY += e.clientY - this._lastY;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      this.onDraw();
    });

    window.addEventListener('mouseup', () => {
      this._dragging = false;
      this.canvas.cursor = 'grab';
    });

    this.canvas.cursor = 'grab';
  }
}

export { CanvasInteraction };
