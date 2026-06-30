class CanvasAdapter {
  constructor(canvasId, outerId) {
    this.canvas = document.getElementById(canvasId);
    this.outer = document.getElementById(outerId);
    this.ctx = this.canvas.getContext('2d');
  }

  get width() {
    return this.outer.getBoundingClientRect().width;
  }

  get height() {
    return this.outer.getBoundingClientRect().height;
  }

  get dpr() {
    return window.devicePixelRatio || 1;
  }

  setSize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  setStyleSize(cssWidth, cssHeight) {
    this.canvas.style.width = cssWidth + 'px';
    this.canvas.style.height = cssHeight + 'px';
  }

  setTransform(dpr) {
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  getBoundingClientRect() {
    return this.canvas.getBoundingClientRect();
  }

  addEventListener(event, handler, options) {
    this.canvas.addEventListener(event, handler, options);
  }

  set cursor(value) {
    this.canvas.style.cursor = value;
  }
}

export { CanvasAdapter };
