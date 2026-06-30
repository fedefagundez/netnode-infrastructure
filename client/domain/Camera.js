class Camera {
  constructor(dpr = 1) {
    this.dpr = dpr;
    this.width = 0;
    this.height = 0;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  scrToWorld(sx, sy) {
    return {
      x: (sx - this.offsetX) / this.scale,
      y: (sy - this.offsetY) / this.scale,
    };
  }

  worldToScr(wx, wy) {
    return {
      x: wx * this.scale + this.offsetX,
      y: wy * this.scale + this.offsetY,
    };
  }

  zoom(factor, cx, cy) {
    const { MIN, MAX } = Camera.ZOOM;
    const newScale = Math.min(MAX, Math.max(MIN, this.scale * factor));
    const ratio = newScale / this.scale;
    this.offsetX = cx - (cx - this.offsetX) * ratio;
    this.offsetY = cy - (cy - this.offsetY) * ratio;
    this.scale = newScale;
  }

  setSize(width, height, dpr) {
    this.width = width;
    this.height = height;
    if (dpr !== undefined) this.dpr = dpr;
  }

  reset() {
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
  }
}

Camera.ZOOM = { MIN: 0.25, MAX: 4 };

export { Camera };
