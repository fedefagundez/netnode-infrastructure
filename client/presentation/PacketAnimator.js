import { ANIMATION } from '../domain/constants.js';

class PacketAnimator {
  constructor({ getPosition, getNode, onDraw, onComplete, onSpecialNodeReached }) {
    this.getPosition = getPosition;
    this.getNode = getNode || (() => null);
    this.onDraw = onDraw;
    this.onComplete = onComplete || (() => {});
    this.onSpecialNodeReached = onSpecialNodeReached || (() => {});
    this.packets = [];
    this.dnsQueries = [];
    this.animId = null;
    this.routerCentralId = null;
    this.dnsId = null;
  }

  setSpecialNodes(routerCentralId, dnsId) {
    this.routerCentralId = routerCentralId;
    this.dnsId = dnsId;
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
        if (arrivedAt === this.routerCentralId && this.dnsId != null && pkt.dnsPending === undefined) {
          pkt.paused = true;
          pkt.dnsPending = true;
          const pos = this.getPosition(arrivedAt);
          pkt.pos = pos ? { x: pos.x, y: pos.y } : null;
          this.triggerDnsQuery(pkt);
          continue;
        }
      }

      if (pkt.edgeIdx >= pkt.path.length - 1) {
        this._finishPacket(pkt);
        continue;
      }

      const currentNodeId = pkt.path[pkt.edgeIdx + 1];
      if (currentNodeId !== pkt.lastVisitedNodeId) {
        pkt.lastVisitedNodeId = currentNodeId;
        const node = this.getNode(currentNodeId);
        if (node && node.type && node.type !== 'client') {
          this.onSpecialNodeReached(node);
        }
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

  triggerDnsQuery(originalPacket) {
    if (this.routerCentralId == null || this.dnsId == null) {
      originalPacket.paused = false;
      originalPacket.dnsPending = false;
      return;
    }

    const routerPos = this.getPosition(this.routerCentralId);
    const dnsPos = this.getPosition(this.dnsId);
    if (!routerPos || !dnsPos) {
      originalPacket.paused = false;
      originalPacket.dnsPending = false;
      return;
    }

    this.dnsQueries.push({
      path: [this.routerCentralId, this.dnsId, this.routerCentralId],
      edgeIdx: 0,
      t: 0,
      pos: { ...routerPos },
      alive: true,
      originalPacket,
      color: '#e74c3c',
    });

    if (!this.animId) {
      this.step();
    }
  }

  stepDns() {
    for (const q of this.dnsQueries) {
      if (!q.alive) continue;

      q.t += ANIMATION.DNS_SPEED;
      if (q.t >= 1) {
        q.t = 0;
        q.edgeIdx++;
      }

      if (q.edgeIdx >= q.path.length - 1) {
        q.alive = false;
        const last = this.getPosition(q.path[q.path.length - 1]);
        q.pos = last ? { ...last } : null;

        const op = q.originalPacket;
        op.paused = false;
        op.dnsPending = false;
        op.t = 0;

        this.onDraw();

        setTimeout(() => {
          q.pos = null;
          this.onDraw();
        }, ANIMATION.DNS_FADE_DELAY);
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
