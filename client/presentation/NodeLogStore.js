class NodeLogStore {
  constructor(maxEntries = 50) {
    this.logs = new Map();
    this.maxEntries = maxEntries;
  }

  add(nodeId, text, type, timestamp) {
    if (!this.logs.has(nodeId)) {
      this.logs.set(nodeId, []);
    }
    const entries = this.logs.get(nodeId);
    entries.push({ text, type, timestamp: timestamp || Date.now() });
    if (entries.length > this.maxEntries) entries.shift();
  }

  get(nodeId) {
    return this.logs.get(nodeId) || [];
  }

  clear(nodeId) {
    this.logs.delete(nodeId);
  }

  clearAll() {
    this.logs.clear();
  }
}

export { NodeLogStore };
