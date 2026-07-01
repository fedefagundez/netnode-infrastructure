class NodeAnimationManager {
  constructor() {
    this.animations = new Map();
    this.PC_DURATION = 1200;
    this.ROUTER_DURATION = 900;
    this.DNS_DURATION = 1100;
    this.FIREWALL_ACCEPT_DURATION = 1000;
    this.FIREWALL_REJECT_DURATION = 900;
  }

  trigger(nodeId, type = 'default') {
    let duration = this.PC_DURATION;
    let animType = type;

    if (type === 'router') {
      duration = this.ROUTER_DURATION;
    } else if (type === 'dns') {
      duration = this.DNS_DURATION;
    } else if (type === 'accept') {
      duration = this.FIREWALL_ACCEPT_DURATION;
    } else if (type === 'reject') {
      duration = this.FIREWALL_REJECT_DURATION;
      animType = 'reject';
    }

    const existing = this.animations.get(nodeId);
    if (existing) {
      cancelAnimationFrame(existing.frameId);
    }

    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);

      this.animations.set(nodeId, {
        progress,
        type: animType,
        frameId: null,
      });

      if (progress < 1) {
        const frameId = requestAnimationFrame(animate);
        this.animations.get(nodeId).frameId = frameId;
      } else {
        this.animations.delete(nodeId);
      }
    };

    const frameId = requestAnimationFrame(animate);
    this.animations.set(nodeId, { progress: 0, type: animType, frameId });
  }

  getAnimation(nodeId) {
    return this.animations.get(nodeId) || null;
  }

  clear() {
    for (const [nodeId, anim] of this.animations) {
      if (anim.frameId) {
        cancelAnimationFrame(anim.frameId);
      }
    }
    this.animations.clear();
  }
}

export { NodeAnimationManager };
