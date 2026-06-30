import { drawNodeByType, drawPacket, drawDnsPacket } from './NodeRenderer.js';
import { calculatePositions } from '../domain/layout.js';

function drawTopology(ctx, cam, nodes, edges, options = {}) {
  const { animator = null, theme = null, topology = 'school-network' } = options;
  const t = theme;

  ctx.clearRect(0, 0, cam.width, cam.height);
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, cam.width, cam.height);

  const positions = calculatePositions(nodes, cam.width, cam.height, topology);
  const posMap = new Map(positions.map(p => [p.node.id, p]));

  ctx.save();
  ctx.translate(cam.offsetX, cam.offsetY);
  ctx.scale(cam.scale, cam.scale);

  drawGrid(ctx, cam, t);
  drawEdges(ctx, cam, edges, posMap, t);
  drawNodes(ctx, cam, positions, t);

  if (animator) {
    drawPackets(ctx, cam, animator);
  }

  ctx.restore();
}

function drawGrid(ctx, cam, t) {
  const step = Math.round(cam.width / 17 / cam.scale);
  const wLeft = -cam.offsetX / cam.scale;
  const wTop = -cam.offsetY / cam.scale;
  const wRight = (cam.width - cam.offsetX) / cam.scale;
  const wBottom = (cam.height - cam.offsetY) / cam.scale;

  ctx.strokeStyle = t.grid;
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

function drawEdges(ctx, cam, edges, posMap, t) {
  ctx.lineCap = 'round';
  for (const edge of edges) {
    const a = posMap.get(edge.from);
    const b = posMap.get(edge.to);
    if (!a || !b) continue;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);

    if (!a.node.on || !b.node.on) {
      ctx.strokeStyle = t.edgeDead;
      ctx.setLineDash([4 / cam.scale, 4 / cam.scale]);
    } else {
      ctx.strokeStyle = t.edge;
      ctx.setLineDash([]);
    }
    ctx.lineWidth = 1.5 / cam.scale;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawNodes(ctx, cam, positions, t) {
  const nr = Math.max(14, Math.round(cam.width * 0.025));
  const colors = {
    nodeActive: t.nodeActive,
    nodeActiveBr: t.nodeActiveBr,
    nodeOff: t.nodeOff,
    nodeOffBr: t.nodeOffBr,
    nodeMe: t.nodeActive,
    nodeMeBr: t.nodeActiveBr,
    lblOn: t.lblOn,
    lblOff: t.lblOff,
    theme: t,
  };
  for (const pos of positions) {
    drawNodeByType(ctx, pos.node, pos.x, pos.y, nr, colors, cam.scale);
  }
}

function drawPackets(ctx, cam, animator) {
  const pr = Math.max(7, Math.round(cam.width * 0.012));
  for (const pkt of animator.packets) {
    if (pkt.pos) {
      drawPacket(ctx, pkt.pos.x, pkt.pos.y, pr, cam.scale);
    }
  }
  const dnsPr = Math.max(5, Math.round(cam.width * 0.008));
  for (const q of animator.dnsQueries) {
    if (q.pos) {
      drawDnsPacket(ctx, q.pos.x, q.pos.y, dnsPr, cam.scale);
    }
  }
}

export { drawTopology };
