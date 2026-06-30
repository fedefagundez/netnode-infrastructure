import { drawNodeByType, drawPacket, drawDnsPacket, isDark } from './NodeRenderer.js';
import { getThemeColors } from '../domain/ThemeColors.js';
import { PacketAnimator } from './PacketAnimator.js';
import { NODE_TYPE_INFO } from '../domain/NodeTypes.js';

class CanvasRenderer {
  constructor(canvasAdapter, camera, network) {
    this.canvas = canvasAdapter;
    this.camera = camera;
    this.network = network;
    this.onAnimationComplete = null;
    this.hoveredNode = null;
    this.tooltip = null;

    this.animator = new PacketAnimator({
      getPosition: (id) => this.network.getNode(id),
      getNode: (id) => this.network.getNode(id),
      onDraw: () => this.draw(),
      onComplete: () => { if (this.onAnimationComplete) this.onAnimationComplete(); },
      onSpecialNodeReached: (node) => this.onSpecialNodeReached(node),
    });

    this._setupTooltip();
    window.addEventListener('themechange', () => this.draw());
  }

  setupSpecialNodes() {
    const { routerCentral, dns } = this.network.getSpecialNodes();
    if (routerCentral && dns) {
      this.animator.setSpecialNodes(routerCentral.id, dns.id);
    }
  }

  _setupTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'node-tooltip hidden';
    document.body.appendChild(this.tooltip);

    this.canvas.canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this.canvas.canvas.addEventListener('mouseleave', () => this._onMouseLeave());
  }

  _onMouseMove(e) {
    const rect = this.canvas.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const nodeId = this.network.getNodeAt(sx, sy);
    const node = nodeId !== null ? this.network.getNode(nodeId) : null;

    if (node && node.type && node.type !== 'client') {
      this.hoveredNode = node;
      const info = NODE_TYPE_INFO[node.type];
      if (info) {
        this.tooltip.innerHTML = `<strong>${info.label}</strong><br>${info.description}`;
        this.tooltip.style.left = (e.clientX + 15) + 'px';
        this.tooltip.style.top = (e.clientY + 15) + 'px';
        this.tooltip.classList.remove('hidden');
      }
    } else {
      this._onMouseLeave();
    }
  }

  _onMouseLeave() {
    this.hoveredNode = null;
    this.tooltip.classList.add('hidden');
  }

  onSpecialNodeReached(node) {
    const info = NODE_TYPE_INFO[node.type];
    if (!info) return;

    const notification = document.createElement('div');
    notification.className = 'special-node-notification';
    notification.innerHTML = `<strong>${info.label}</strong>: ${info.description}`;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 500);
    }, 2000);
  }

  pal() {
    return getThemeColors();
  }

  draw() {
    const cam = this.camera;
    const net = this.network;
    const ctx = this.canvas.ctx;

    if (!cam.width || !cam.height) return;

    const c = this.pal();
    const nr = net.nodeR();

    ctx.clearRect(0, 0, cam.width, cam.height);
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, cam.width, cam.height);

    ctx.save();
    ctx.translate(cam.offsetX, cam.offsetY);
    ctx.scale(cam.scale, cam.scale);

    this.drawGrid(ctx, cam, c);
    this.drawEdges(ctx, cam, net, c);
    this.drawNodes(ctx, cam, net, c, nr);
    this.drawPackets(ctx, cam);

    ctx.restore();
  }

  drawGrid(ctx, cam, c) {
    const step = Math.round(cam.width / 17 / cam.scale);
    const wLeft = -cam.offsetX / cam.scale;
    const wTop = -cam.offsetY / cam.scale;
    const wRight = (cam.width - cam.offsetX) / cam.scale;
    const wBottom = (cam.height - cam.offsetY) / cam.scale;

    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 1 / cam.scale;

    for (let x = Math.floor(wLeft / step) * step; x <= wRight; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, wTop);
      ctx.lineTo(x, wBottom);
      ctx.stroke();
    }
    for (let y = Math.floor(wTop / step) * step; y <= wBottom; y += step) {
      ctx.beginPath();
      ctx.moveTo(wLeft, y);
      ctx.lineTo(wRight, y);
      ctx.stroke();
    }
  }

  drawEdges(ctx, cam, net, c) {
    ctx.lineCap = 'round';
    for (const edge of net.edges) {
      const na = net.getNode(edge.from);
      const nb = net.getNode(edge.to);
      if (!na || !nb) continue;

      ctx.beginPath();
      ctx.moveTo(na.x, na.y);
      ctx.lineTo(nb.x, nb.y);

      if (!na.on || !nb.on) {
        ctx.strokeStyle = c.edgeDead;
        ctx.lineWidth = 1.5 / cam.scale;
        ctx.setLineDash([5 / cam.scale, 5 / cam.scale]);
      } else {
        ctx.strokeStyle = c.edge;
        ctx.lineWidth = 1.5 / cam.scale;
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawNodes(ctx, cam, net, c, nr) {
    const colors = {
      nodeActive: c.nodeActive,
      nodeActiveBr: c.nodeActiveBr,
      nodeOff: c.nodeOff,
      nodeOffBr: c.nodeOffBr,
      nodeMe: c.nodeMe,
      nodeMeBr: c.nodeMeBr,
      lblOn: c.lblOn,
      lblOff: c.lblOff,
      myNodeId: net.myNodeId,
      theme: c,
    };
    for (const n of net.nodes) {
      drawNodeByType(ctx, n, n.x, n.y, nr, colors, cam.scale);
    }
  }

  drawPackets(ctx, cam) {
    const pr = Math.max(7, Math.round(cam.width * 0.012));
    for (const pkt of this.animator.packets) {
      if (pkt.pos) {
        drawPacket(ctx, pkt.pos.x, pkt.pos.y, pr, cam.scale);
      }
    }
    const dnsPr = Math.max(5, Math.round(cam.width * 0.008));
    for (const q of this.animator.dnsQueries) {
      if (q.pos) {
        drawDnsPacket(ctx, q.pos.x, q.pos.y, dnsPr, cam.scale);
      }
    }
  }

  animatePacket(path) {
    this.animator.animate(path);
  }

  stopAnimation() {
    this.animator.stop();
  }
}

export { CanvasRenderer };
