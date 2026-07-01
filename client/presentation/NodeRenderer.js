import { isDark, getThemeColors } from '../domain/ThemeColors.js';

function drawNode(ctx, node, x, y, radius, colors, scale = 1) {
  const { nodeActive, nodeActiveBr, nodeOff, nodeOffBr, nodeMe, nodeMeBr, lblOn, lblOff } = colors;
  const isMe = colors.myNodeId !== undefined && node.id === colors.myNodeId;

  let fill, border;
  if (!node.on) {
    fill = nodeOff;
    border = nodeOffBr;
  } else if (isMe) {
    fill = nodeMe;
    border = nodeMeBr;
  } else {
    fill = nodeActive;
    border = nodeActiveBr;
  }

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 2 / scale;
  ctx.stroke();

  if (!node.on) {
    ctx.save();
    ctx.strokeStyle = isDark() ? '#8b6fb0' : '#a899b8';
    ctx.lineWidth = 2 / scale;
    ctx.lineCap = 'round';
    const s = Math.round(radius * 0.38);
    ctx.beginPath();
    ctx.moveTo(x - s, y - s);
    ctx.lineTo(x + s, y + s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + s, y - s);
    ctx.lineTo(x - s, y + s);
    ctx.stroke();
    ctx.restore();
  }

  const fs = Math.max(13, Math.round(radius * 0.6));
  ctx.fillStyle = node.on ? lblOn : lblOff;
  ctx.font = `bold ${fs}px -apple-system,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.label, x, y);

  const nameFs = Math.max(11, Math.round(radius * 0.35));
  ctx.font = `${nameFs}px -apple-system,sans-serif`;
  ctx.fillStyle = isMe ? nodeMeBr : (isDark() ? '#c4b5e0' : '#4a3570');
  ctx.fillText(node.name, x, y + radius + nameFs + 4);
}

function drawRouterNode(ctx, node, x, y, radius, colors, scale = 1) {
  const theme = colors.theme;
  const isOn = node.on;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);

  const size = radius * 0.85;
  ctx.beginPath();
  ctx.rect(-size, -size, size * 2, size * 2);
  ctx.fillStyle = isOn ? theme.routerFill : theme.infraOff;
  ctx.fill();
  ctx.strokeStyle = isOn ? theme.routerBorder : theme.infraOffBorder;
  ctx.lineWidth = 2 / scale;
  ctx.stroke();

  ctx.restore();

  const fs = Math.max(13, Math.round(radius * 0.6));
  ctx.fillStyle = theme.infraLabel;
  ctx.font = `bold ${fs}px -apple-system,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.label, x, y);

  const nameFs = Math.max(11, Math.round(radius * 0.35));
  ctx.font = `${nameFs}px -apple-system,sans-serif`;
  ctx.fillStyle = isDark() ? theme.textSecondary : '#7d4e1e';
  ctx.fillText(node.name, x, y + radius + nameFs + 4);
}

function drawDNSNode(ctx, node, x, y, radius, colors, scale = 1) {
  const theme = colors.theme;
  const isOn = node.on;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = isOn ? theme.dnsFill : theme.infraOff;
  ctx.fill();
  ctx.strokeStyle = isOn ? theme.dnsBorder : theme.infraOffBorder;
  ctx.lineWidth = 2 / scale;
  ctx.stroke();

  const fs = Math.max(13, Math.round(radius * 0.6));
  ctx.fillStyle = theme.infraLabel;
  ctx.font = `bold ${fs}px -apple-system,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.label, x, y);

  const nameFs = Math.max(11, Math.round(radius * 0.35));
  ctx.font = `${nameFs}px -apple-system,sans-serif`;
  ctx.fillStyle = isDark() ? theme.textDns : '#5b2c6f';
  ctx.fillText(node.name, x, y + radius + nameFs + 4);
}

function drawFirewallNode(ctx, node, x, y, radius, colors, scale = 1) {
  const theme = colors.theme;
  const isOn = node.on;

  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.lineTo(x + radius * 0.85, y - radius * 0.3);
  ctx.lineTo(x + radius * 0.85, y + radius * 0.5);
  ctx.lineTo(x, y + radius);
  ctx.lineTo(x - radius * 0.85, y + radius * 0.5);
  ctx.lineTo(x - radius * 0.85, y - radius * 0.3);
  ctx.closePath();

  ctx.fillStyle = isOn ? theme.firewallFill : theme.infraOff;
  ctx.fill();
  ctx.strokeStyle = isOn ? theme.firewallBorder : theme.infraOffBorder;
  ctx.lineWidth = 2 / scale;
  ctx.stroke();

  const fs = Math.max(13, Math.round(radius * 0.6));
  ctx.fillStyle = theme.infraLabel;
  ctx.font = `bold ${fs}px -apple-system,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.label, x, y);

  const nameFs = Math.max(11, Math.round(radius * 0.35));
  ctx.font = `${nameFs}px -apple-system,sans-serif`;
  ctx.fillStyle = isDark() ? theme.textFirewall : '#922b21';
  ctx.fillText(node.name, x, y + radius + nameFs + 4);
}

function drawNodeByType(ctx, node, x, y, radius, colors, scale = 1) {
  switch (node.type) {
    case 'router':
      drawAnimatedRouterNode(ctx, node, x, y, radius, colors, scale, 0);
      break;
    case 'dns':
      drawAnimatedDNSNode(ctx, node, x, y, radius, colors, scale, 0);
      break;
    case 'firewall':
      drawAnimatedFirewallNode(ctx, node, x, y, radius, colors, scale, 0, 'none');
      break;
    default:
      drawAnimatedPCNode(ctx, node, x, y, radius, colors, scale, 0);
  }
}

function drawPacket(ctx, x, y, radius, scale = 1, theme = null) {
  const t = theme || getThemeColors();
  const pr = Math.max(7, Math.round(radius * 0.012 * 60));
  ctx.beginPath();
  ctx.arc(x, y, pr, 0, Math.PI * 2);
  ctx.fillStyle = t.packet;
  ctx.fill();
  ctx.strokeStyle = t.packetBorder;
  ctx.lineWidth = 2 / scale;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, pr + 5, 0, Math.PI * 2);
  ctx.strokeStyle = t.packetGlow;
  ctx.lineWidth = 1 / scale;
  ctx.stroke();
}

function drawDnsPacket(ctx, x, y, radius, scale = 1, theme = null) {
  const t = theme || getThemeColors();
  const pr = Math.max(4, Math.round(radius * 0.008 * 60));
  ctx.beginPath();
  ctx.arc(x, y, pr, 0, Math.PI * 2);
  ctx.fillStyle = t.dnsPacket;
  ctx.fill();
  ctx.strokeStyle = t.dnsPacketBorder;
  ctx.lineWidth = 1.5 / scale;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, pr + 3, 0, Math.PI * 2);
  ctx.strokeStyle = t.dnsPacketGlow;
  ctx.lineWidth = 1 / scale;
  ctx.stroke();
}

const roundRectCanvas = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
};

const strokeLineCanvas = (ctx, x1, y1, x2, y2) => {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
};

const easeCanvas = {
  inOut: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  in: t => t * t,
  out: t => t * (2 - t),
  linear: t => t,
};

const lerpCanvas = (a, b, t) => a + (b - a) * t;

const sampleFrames = (progress, frames, easingFn) => {
  if (progress <= frames[0].p) return frames[0];
  const last = frames[frames.length - 1];
  if (progress >= last.p) return last;
  for (let i = 0; i < frames.length - 1; i++) {
    const a = frames[i], b = frames[i + 1];
    if (progress >= a.p && progress <= b.p) {
      const local = (b.p - a.p) === 0 ? 0 : (progress - a.p) / (b.p - a.p);
      const e = easingFn(local);
      const out = {};
      for (const k in a) { if (k !== 'p') out[k] = lerpCanvas(a[k], b[k], e); }
      return out;
    }
  }
  return last;
};

const animValue = (elapsedMs, delayMs, durationMs, frames, easingFn, infinite) => {
  if (elapsedMs < delayMs) return frames[0];
  let local = elapsedMs - delayMs;
  if (infinite) {
    local = local % durationMs;
    return sampleFrames(local / durationMs, frames, easingFn);
  }
  if (local >= durationMs) return frames[frames.length - 1];
  return sampleFrames(local / durationMs, frames, easingFn);
};

function drawAnimatedPCNode(ctx, node, x, y, radius, colors, scale = 1, animProgress = 0) {
  const theme = colors.theme;
  const isOn = node.on;
  const isMe = colors.myNodeId !== undefined && node.id === colors.myNodeId;

  const s = radius / 42;

  const haloFrames = [{ p: 0, r: 8 * s, opacity: 0.2 }, { p: 0.5, r: 14 * s, opacity: 0 }, { p: 1, r: 8 * s, opacity: 0.2 }];
  const puntoFrames = [{ p: 0, opacity: 1 }, { p: 0.5, opacity: 0.4 }, { p: 1, opacity: 1 }];

  const active = animProgress > 0 && isOn;
  const elapsedMs = active ? animProgress * 1200 : null;

  const halo = active ? animValue(elapsedMs, 0, 1200, haloFrames, easeCanvas.inOut, true) : { r: 8 * s, opacity: 0 };
  const punto = active ? animValue(elapsedMs, 0, 1200, puntoFrames, easeCanvas.inOut, true) : { opacity: 0.35 };

  roundRectCanvas(ctx, x - 56 * s, y - 46 * s, 112 * s, 76 * s, 10 * s);
  ctx.fillStyle = isOn ? '#cfe0ff' : theme.infraOff;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2563eb';
  ctx.stroke();

  roundRectCanvas(ctx, x - 44 * s, y - 36 * s, 88 * s, 58 * s, 6 * s);
  ctx.fillStyle = isOn ? '#e8f0ff' : '#d0d0d0';
  ctx.fill();

  ctx.fillStyle = isOn ? '#1d4ed8' : '#888';
  ctx.font = `700 ${38 * s}px "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.label, x, y - 6 * s);

  ctx.globalAlpha = halo.opacity;
  ctx.beginPath();
  ctx.arc(x + 44 * s, y - 28 * s, halo.r, 0, Math.PI * 2);
  ctx.fillStyle = '#22c55e';
  ctx.fill();

  ctx.globalAlpha = punto.opacity;
  ctx.beginPath();
  ctx.arc(x + 44 * s, y - 28 * s, 5.5 * s, 0, Math.PI * 2);
  ctx.fillStyle = '#22c55e';
  ctx.fill();
  ctx.globalAlpha = 1;

  roundRectCanvas(ctx, x - 10 * s, y + 30 * s, 20 * s, 10 * s, 2 * s);
  ctx.fillStyle = '#2563eb';
  ctx.fill();
  roundRectCanvas(ctx, x - 26 * s, y + 40 * s, 52 * s, 7 * s, 3 * s);
  ctx.fillStyle = '#9db8e8';
  ctx.fill();

  const nameFs = Math.max(11, Math.round(radius * 0.35));
  ctx.font = `${nameFs}px -apple-system, sans-serif`;
  ctx.fillStyle = isMe ? (isDark() ? theme.textSecondary : '#7d4e1e') : (isDark() ? '#c4b5e0' : '#4a3570');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(node.name, x, y + radius + nameFs * 0.5);
}

function drawAnimatedRouterNode(ctx, node, x, y, radius, colors, scale = 1, animProgress = 0) {
  const theme = colors.theme;
  const isOn = node.on;

  const s = radius / 42;
  const active = animProgress > 0 && isOn;
  const elapsedMs = active ? animProgress * 900 : null;

  const ondaFrames = [{ p: 0, opacity: 0.9, scale: 0.4 }, { p: 1, opacity: 0, scale: 1.6 }];
  const ledOnFrames = [{ p: 0, opacity: 0.2, glow: 0 }, { p: 0.35, opacity: 1, glow: 1 }, { p: 1, opacity: 0.2, glow: 0 }];
  const ROUTER_LEDS = [
    { cx: -22 * s, color: '#22c55e', delay: 0 },
    { cx: -7 * s, color: '#fbbf24', delay: 120 },
    { cx: 8 * s, color: '#3b82f6', delay: 240 },
    { cx: 23 * s, color: '#22c55e', delay: 360 },
  ];

  const onda = active ? animValue(elapsedMs, 0, 900, ondaFrames, easeCanvas.out, false) : { opacity: 0, scale: 1 };
  ctx.save();
  ctx.translate(x, y - 35 * s);
  ctx.scale(onda.scale, onda.scale);
  ctx.translate(-x, -(y - 35 * s));
  ctx.globalAlpha = onda.opacity;
  ctx.beginPath();
  ctx.arc(x, y - 35 * s, 12 * s, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#3b82f6';
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;

  ctx.lineWidth = 3;
  ctx.strokeStyle = '#7a8aab';
  ctx.lineCap = 'round';
  strokeLineCanvas(ctx, x, y - 23 * s, x, y - 16 * s);
  ctx.lineCap = 'butt';

  roundRectCanvas(ctx, x - 36 * s, y - 16 * s, 72 * s, 42 * s, 10 * s);
  ctx.fillStyle = '#d9e3f8';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2563eb';
  ctx.stroke();

  roundRectCanvas(ctx, x - 26 * s, y + 26 * s, 6 * s, 8 * s, 2 * s);
  ctx.fillStyle = '#9db8e8';
  ctx.fill();
  roundRectCanvas(ctx, x + 20 * s, y + 26 * s, 6 * s, 8 * s, 2 * s);
  ctx.fillStyle = '#9db8e8';
  ctx.fill();

  ROUTER_LEDS.forEach(led => {
    const st = active ? animValue(elapsedMs, led.delay, 900, ledOnFrames, easeCanvas.inOut, false) : { opacity: 0.2, glow: 0 };
    ctx.save();
    ctx.globalAlpha = st.opacity;
    if (st.glow > 0.3) {
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 6 * st.glow;
    }
    ctx.beginPath();
    ctx.arc(x + led.cx, y + 5 * s, 5 * s, 0, Math.PI * 2);
    ctx.fillStyle = led.color;
    ctx.fill();
    ctx.restore();
  });
  ctx.globalAlpha = 1;

  const fs = Math.max(13, Math.round(radius * 0.5));
  ctx.fillStyle = theme.infraLabel;
  ctx.font = `bold ${fs}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.label, x, y);

  const nameFs = Math.max(11, Math.round(radius * 0.35));
  ctx.font = `${nameFs}px -apple-system, sans-serif`;
  ctx.fillStyle = isDark() ? theme.textSecondary : '#7d4e1e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(node.name, x, y + radius + nameFs * 0.5);
}

function drawAnimatedDNSNode(ctx, node, x, y, radius, colors, scale = 1, animProgress = 0) {
  const theme = colors.theme;
  const isOn = node.on;

  const s = radius / 38;
  const active = animProgress > 0 && isOn;
  const elapsedMs = active ? animProgress * 1100 : null;

  const brilloFrames = [{ p: 0, opacity: 0 }, { p: 0.5, opacity: 0.55 }, { p: 1, opacity: 0 }];
  const lupaFrames = [
    { p: 0, tx: 0, ty: 0, rot: 0 },
    { p: 0.25, tx: -7, ty: -4, rot: -8 },
    { p: 0.5, tx: 4, ty: 5, rot: 6 },
    { p: 0.75, tx: -3, ty: 2, rot: -3 },
    { p: 1, tx: 0, ty: 0, rot: 0 },
  ];

  const brillo = active ? animValue(elapsedMs, 0, 1100, brilloFrames, easeCanvas.inOut, false) : { opacity: 0 };
  roundRectCanvas(ctx, x - 32 * s, y - 35 * s, 60 * s, 55 * s, 10 * s);
  ctx.globalAlpha = brillo.opacity;
  ctx.fillStyle = '#fbbf24';
  ctx.fill();
  ctx.globalAlpha = 1;

  roundRectCanvas(ctx, x - 28 * s, y - 30 * s, 52 * s, 48 * s, 8 * s);
  ctx.fillStyle = '#cfe0ff';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#2563eb';
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#2563eb';
  ctx.lineCap = 'round';
  strokeLineCanvas(ctx, x - 20 * s, y - 18 * s, x + 16 * s, y - 18 * s);
  strokeLineCanvas(ctx, x - 20 * s, y - 8 * s, x + 10 * s, y - 8 * s);
  strokeLineCanvas(ctx, x - 20 * s, y + 2 * s, x + 2 * s, y + 2 * s);
  ctx.lineCap = 'butt';

  const lupa = active ? animValue(elapsedMs, 0, 1100, lupaFrames, easeCanvas.inOut, false) : { tx: 0, ty: 0, rot: 0 };
  ctx.save();
  ctx.translate(x + 14 * s, y + 14 * s);
  ctx.translate(lupa.tx * s, lupa.ty * s);
  ctx.rotate(lupa.rot * Math.PI / 180);
  ctx.translate(-(x + 14 * s), -(y + 14 * s));
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(x + 18 * s, y + 14 * s, 13 * s, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#16a34a';
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#16a34a';
  strokeLineCanvas(ctx, x + 28 * s, y + 24 * s, x + 38 * s, y + 34 * s);
  ctx.restore();
  ctx.globalAlpha = 1;

  const fs = Math.max(13, Math.round(radius * 0.5));
  ctx.fillStyle = theme.infraLabel;
  ctx.font = `bold ${fs}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.label, x, y);

  const nameFs = Math.max(11, Math.round(radius * 0.35));
  ctx.font = `${nameFs}px -apple-system, sans-serif`;
  ctx.fillStyle = isDark() ? theme.textDns : '#5b2c6f';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(node.name, x, y + radius + nameFs * 0.5);
}

function drawAnimatedFirewallNode(ctx, node, x, y, radius, colors, scale = 1, animProgress = 0, animType = 'none') {
  const theme = colors.theme;
  const isOn = node.on;

  const s = radius / 50;
  const active = animProgress > 0 && isOn;
  const elapsedMs = active ? animProgress * 1000 : null;

  const glowFrames = [{ p: 0, opacity: 0 }, { p: 0.5, opacity: 0.7 }, { p: 1, opacity: 0 }];
  const pasaFrames = [{ p: 0, opacity: 1, tx: -34 }, { p: 0.55, opacity: 1, tx: 0 }, { p: 1, opacity: 0, tx: 34 }];
  const checkFrames = [{ p: 0, opacity: 0, scale: 0.3 }, { p: 0.6, opacity: 1, scale: 1.15 }, { p: 1, opacity: 1, scale: 1 }];
  const rebotaFrames = [
    { p: 0, opacity: 1, tx: -34, rot: 0, scale: 1 },
    { p: 0.45, opacity: 1, tx: -2, rot: 10, scale: 1 },
    { p: 0.7, opacity: 1, tx: -22, rot: -25, scale: 0.7 },
    { p: 1, opacity: 0, tx: -40, rot: -60, scale: 0.2 },
  ];
  const shakeFrames = [{ p: 0, tx: 0 }, { p: 0.2, tx: -3 }, { p: 0.4, tx: 3 }, { p: 0.6, tx: -2 }, { p: 0.8, tx: 2 }, { p: 1, tx: 0 }];
  const xFrames = [{ p: 0, opacity: 0, scale: 0.3 }, { p: 0.6, opacity: 1, scale: 1.2 }, { p: 1, opacity: 1, scale: 1 }];

  let glowGreen = 0, glowRed = 0, shakeX = 0;
  let paqueteAccept = null, checkState = null, paqueteReject = null, xState = null;

  if (animType === 'accept' && active) {
    paqueteAccept = animValue(elapsedMs, 0, 1000, pasaFrames, easeCanvas.in, false);
    glowGreen = animValue(elapsedMs, 350, 600, glowFrames, easeCanvas.inOut, false).opacity;
    checkState = animValue(elapsedMs, 450, 600, checkFrames, easeCanvas.out, false);
  } else if (animType === 'reject' && active) {
    paqueteReject = animValue(elapsedMs, 0, 900, rebotaFrames, easeCanvas.out, false);
    glowRed = animValue(elapsedMs, 300, 600, glowFrames, easeCanvas.inOut, false).opacity;
    shakeX = animValue(elapsedMs, 300, 450, shakeFrames, easeCanvas.inOut, false).tx;
    xState = animValue(elapsedMs, 400, 500, xFrames, easeCanvas.out, false);
  }

  const shieldPathDraw = () => {
    ctx.beginPath();
    ctx.moveTo(x, y - 36 * s);
    ctx.lineTo(x + 30 * s, y - 26 * s);
    ctx.lineTo(x + 30 * s, y + 2 * s);
    ctx.bezierCurveTo(x + 30 * s, y + 20 * s, x + 17 * s, y + 32 * s, x, y + 38 * s);
    ctx.bezierCurveTo(x - 17 * s, y + 32 * s, x - 30 * s, y + 20 * s, x - 30 * s, y + 2 * s);
    ctx.lineTo(x - 30 * s, y - 26 * s);
    ctx.closePath();
  };

  ctx.save();
  shieldPathDraw();
  ctx.globalAlpha = glowGreen;
  ctx.fillStyle = '#22c55e';
  ctx.fill();
  ctx.restore();

  ctx.save();
  shieldPathDraw();
  ctx.globalAlpha = glowRed;
  ctx.fillStyle = '#ef4444';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(shakeX * s, 0);
  shieldPathDraw();
  ctx.fillStyle = '#dfe7f7';
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#2563eb';
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#9db8e8';
  strokeLineCanvas(ctx, x - 18 * s, y - 10 * s, x + 18 * s, y - 10 * s);
  strokeLineCanvas(ctx, x - 18 * s, y + 2 * s, x + 18 * s, y + 2 * s);
  strokeLineCanvas(ctx, x - 18 * s, y + 14 * s, x + 10 * s, y + 14 * s);
  ctx.restore();

  if (paqueteAccept) {
    ctx.save();
    ctx.translate(paqueteAccept.tx * s, 0);
    ctx.globalAlpha = paqueteAccept.opacity;
    roundRectCanvas(ctx, x - 6 * s, y - 4 * s, 14 * s, 14 * s, 3 * s);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
    ctx.restore();
  }

  if (checkState) {
    ctx.save();
    ctx.translate(x + 1 * s, y);
    ctx.scale(checkState.scale, checkState.scale);
    ctx.translate(-(x + 1 * s), -y);
    ctx.globalAlpha = checkState.opacity;
    ctx.beginPath();
    ctx.moveTo(x - 11 * s, y + 1 * s);
    ctx.lineTo(x - 3 * s, y + 9 * s);
    ctx.lineTo(x + 12 * s, y - 9 * s);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#16a34a';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  if (paqueteReject) {
    ctx.save();
    ctx.translate(x + 1 * s, y + 3 * s);
    ctx.translate(paqueteReject.tx * s, 0);
    ctx.rotate(paqueteReject.rot * Math.PI / 180);
    ctx.scale(paqueteReject.scale, paqueteReject.scale);
    ctx.translate(-(x + 1 * s), -(y + 3 * s));
    ctx.globalAlpha = paqueteReject.opacity;
    roundRectCanvas(ctx, x - 6 * s, y - 4 * s, 14 * s, 14 * s, 3 * s);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.restore();
  }

  if (xState) {
    ctx.save();
    ctx.translate(x - 3 * s, y + 2 * s);
    ctx.scale(xState.scale, xState.scale);
    ctx.translate(3 * s, -2 * s);
    ctx.globalAlpha = xState.opacity;
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#dc2626';
    ctx.lineCap = 'round';
    strokeLineCanvas(ctx, x - 9 * s, y - 7 * s, x + 9 * s, y + 7 * s);
    strokeLineCanvas(ctx, x + 9 * s, y - 7 * s, x - 9 * s, y + 7 * s);
    ctx.restore();
  }

  ctx.globalAlpha = 1;

  const fs = Math.max(13, Math.round(radius * 0.5));
  ctx.fillStyle = theme.infraLabel;
  ctx.font = `bold ${fs}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(node.label, x, y);

  const nameFs = Math.max(11, Math.round(radius * 0.35));
  ctx.font = `${nameFs}px -apple-system, sans-serif`;
  ctx.fillStyle = isDark() ? theme.textFirewall : '#922b21';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(node.name, x, y + radius + nameFs * 0.5);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawNodeByTypeAnimated(ctx, node, x, y, radius, colors, scale = 1, animState = null) {
  const animProgress = animState ? animState.progress : 0;
  const animType = animState ? animState.type : 'none';

  switch (node.type) {
    case 'router':
      drawAnimatedRouterNode(ctx, node, x, y, radius, colors, scale, animProgress);
      break;
    case 'dns':
      drawAnimatedDNSNode(ctx, node, x, y, radius, colors, scale, animProgress);
      break;
    case 'firewall':
      drawAnimatedFirewallNode(ctx, node, x, y, radius, colors, scale, animProgress, animType);
      break;
    default:
      drawAnimatedPCNode(ctx, node, x, y, radius, colors, scale, animProgress);
  }
}

export { drawNode, drawNodeByType, drawNodeByTypeAnimated, drawPacket, drawDnsPacket, drawAnimatedPCNode, drawAnimatedRouterNode, drawAnimatedDNSNode, drawAnimatedFirewallNode, roundRect, isDark };
