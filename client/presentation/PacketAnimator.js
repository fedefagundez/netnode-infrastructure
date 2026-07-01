import { ANIMATION } from '../domain/constants.js';

class PacketAnimator {
  constructor({ getPosition, getNode, onDraw, onNodeVisited, onComplete }) {
    this.getPosition = getPosition;
    this.getNode = getNode || (() => null);
    this.onDraw = onDraw;
    this.onNodeVisited = onNodeVisited || (() => {});
    this.onComplete = onComplete || (() => {});
    this.packets = [];
    this.dnsQueries = [];
    this.animId = null;
    this.routerCentralId = null;
    this.dnsId = null;
    this.onDnsQueryComplete = null;
    this.onClientDnsComplete = null;
  }

  setSpecialNodes(routerCentralId, dnsId) {
    this.routerCentralId = routerCentralId;
    this.dnsId = dnsId;
  }

  setOnDnsQueryComplete(callback) {
    this.onDnsQueryComplete = callback;
  }

  animateDnsQuery(path, callback) {
    console.log('[PacketAnimator] animateDnsQuery called, path:', path);
    if (!path || path.length < 2) {
      console.log('[PacketAnimator] invalid path');
      if (callback) callback();
      return;
    }

    const firstPos = this.getPosition(path[0]);
    if (!firstPos) {
      console.log('[PacketAnimator] first position not found');
      if (callback) callback();
      return;
    }

    this.dnsQueries.push({
      path: path,
      edgeIdx: 0,
      t: 0,
      pos: { ...firstPos },
      alive: true,
      isClientDns: true,
      onComplete: callback,
      color: '#e74c3c',
    });
    console.log('[PacketAnimator] dnsQueries:', this.dnsQueries.length);

    if (!this.animId) {
      console.log('[PacketAnimator] starting animation loop');
      this.step();
    }
  }

  animate(path) {
    this.packets.push({
      path,
      edgeIdx: 0,
      t: 0,
      lastVisitedNodeId: null,
      pos: null,
      alive: true,
      paused: false,
      color: null,
    });

    if (!this.animId) {
      this.step();
    }
  }

  step() {
    for (const pkt of this.packets) {
      if (!pkt.alive || pkt.paused) continue;

      pkt.t += ANIMATION.PACKET_SPEED;
      if (pkt.t >= 1) {
        pkt.t = 0;
        pkt.edgeIdx++;

        const arrivedAt = pkt.path[pkt.edgeIdx];
        const arrivedNode = this.getNode(arrivedAt);
        if (arrivedNode) {
          const animType = arrivedNode.type === 'firewall' ? 'accept' : arrivedNode.type;
          this.onNodeVisited(arrivedAt, animType);
        }
      }

      if (pkt.edgeIdx >= pkt.path.length - 1) {
        this._finishPacket(pkt);
        continue;
      }

      const a = this.getPosition(pkt.path[pkt.edgeIdx]);
      const b = this.getPosition(pkt.path[pkt.edgeIdx + 1]);
      if (!a || !b) continue;

      pkt.pos = {
        x: a.x + (b.x - a.x) * pkt.t,
        y: a.y + (b.y - a.y) * pkt.t,
      };
    }

    this.stepDns();
    this.packets = this.packets.filter(p => p.alive);

    if (this.packets.length > 0 || this.dnsQueries.length > 0) {
      this.onDraw();
      this.animId = requestAnimationFrame(() => this.step());
    } else {
      this.animId = null;
    }
  }

  stepDns() {
    if (this.dnsQueries.length > 0) {
      console.log('[PacketAnimator] stepDns running, queries:', this.dnsQueries.length);
    }
    for (const q of this.dnsQueries) {
      if (!q.alive) continue;

      q.t += ANIMATION.DNS_SPEED;
      if (q.t >= 1) {
        q.t = 0;
        q.edgeIdx++;
        console.log('[PacketAnimator] DNS query edgeIdx:', q.edgeIdx, 'path length:', q.path.length);
        const arrivedAt = q.path[q.edgeIdx];
        const arrivedNode = this.getNode(arrivedAt);
        if (arrivedNode) {
          this.onNodeVisited(arrivedAt, arrivedNode.type);
        }
      }

      if (q.edgeIdx >= q.path.length - 1) {
        q.alive = false;
        const last = this.getPosition(q.path[q.path.length - 1]);
        q.pos = last ? { ...last } : null;

        if (q.isClientDns) {
          setTimeout(() => {
            q.pos = null;
            this.onDraw();
            console.log('[PacketAnimator] DNS animation complete, calling callbacks');
            if (q.onComplete) q.onComplete();
            if (this.onClientDnsComplete) this.onClientDnsComplete();
          }, ANIMATION.DNS_FADE_DELAY);
        } else {
          this.onDraw();
          setTimeout(() => {
            q.pos = null;
            this.onDraw();
          }, ANIMATION.DNS_FADE_DELAY);
        }
        continue;
      }

      const a = this.getPosition(q.path[q.edgeIdx]);
      const b = this.getPosition(q.path[q.edgeIdx + 1]);
      if (!a || !b) continue;

      q.pos = {
        x: a.x + (b.x - a.x) * q.t,
        y: a.y + (b.y - a.y) * q.t,
      };
    }

    this.dnsQueries = this.dnsQueries.filter(q => q.alive);
  }

  _finishPacket(pkt) {
    const last = this.getPosition(pkt.path[pkt.path.length - 1]);
    pkt.pos = last ? { x: last.x, y: last.y } : null;
    pkt.alive = false;
    this.onDraw();

    setTimeout(() => {
      pkt.pos = null;
      this.onDraw();
      this.onComplete();
    }, ANIMATION.PACKET_FINISH_DELAY);
  }

  stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.packets = [];
    this.dnsQueries = [];
  }
}

export { PacketAnimator };
