class Edge {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }

  has(nodeId) {
    return this.from === nodeId || this.to === nodeId;
  }

  connects(a, b) {
    return (this.from === a && this.to === b) || (this.from === b && this.to === a);
  }

  other(nodeId) {
    return this.from === nodeId ? this.to : this.to === nodeId ? this.from : null;
  }
}

export { Edge };
