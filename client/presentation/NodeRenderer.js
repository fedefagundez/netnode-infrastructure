import { isDark } from '../domain/ThemeColors.js';

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
      drawRouterNode(ctx, node, x, y, radius, colors, scale);
      break;
    case 'dns':
      drawDNSNode(ctx, node, x, y, radius, colors, scale);
      break;
    case 'firewall':
      drawFirewallNode(ctx, node, x, y, radius, colors, scale);
      break;
    default:
      drawNode(ctx, node, x, y, radius, colors, scale);
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

export { drawNode, drawNodeByType, drawPacket, drawDnsPacket, isDark };
