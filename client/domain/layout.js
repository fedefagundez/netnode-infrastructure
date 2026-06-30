function calculatePositions(nodes, width, height, topology) {
  if (nodes.length === 0) return [];

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.38;

  switch (topology) {
    case 'school-network':
      return layoutSchoolNetwork(nodes, width, height);
    case 'chain':
      return layoutChain(nodes, width, height);
    case 'ring':
      return layoutCircle(nodes, cx, cy, radius);
    case 'star':
      return layoutStar(nodes, cx, cy, radius);
    case 'tree':
      return layoutTree(nodes, width, height);
    case 'grid':
      return layoutGrid(nodes, width, height);
    case 'mesh-partial':
    case 'mesh-full':
    case 'small-world':
    case 'scale-free':
    case 'random':
      return layoutCircle(nodes, cx, cy, radius);
    default:
      return layoutGrid(nodes, width, height);
  }
}

function layoutSchoolNetwork(nodes, width, height) {
  const marginX = width * 0.06;
  const marginY = height * 0.04;
  const availW = width - marginX * 2;
  const availH = height - marginY * 2;
  const cx = marginX + availW / 2;

  let dnsNode = null;
  let coreRouter = null;
  const subnets = {};

  for (const n of nodes) {
    if (n.type === 'dns') {
      dnsNode = n;
    } else if (n.type === 'router' && n.subnetId == null) {
      coreRouter = n;
    } else if (n.type === 'router' && n.subnetId != null) {
      if (!subnets[n.subnetId]) subnets[n.subnetId] = { router: null, firewall: null, clients: [] };
      subnets[n.subnetId].router = n;
    } else if (n.type === 'firewall' && n.subnetId != null) {
      if (!subnets[n.subnetId]) subnets[n.subnetId] = { router: null, firewall: null, clients: [] };
      subnets[n.subnetId].firewall = n;
    } else {
      const sid = n.subnetId != null ? n.subnetId : 0;
      if (!subnets[sid]) subnets[sid] = { router: null, firewall: null, clients: [] };
      subnets[sid].clients.push(n);
    }
  }

  const subnetIds = Object.keys(subnets).map(Number).sort((a, b) => a - b);
  const result = [];

  const rowH = availH / 5;
  const rowDNS = marginY + rowH * 0.5;
  const rowCore = marginY + rowH * 1.5;
  const rowRouters = marginY + rowH * 2.5;
  const rowFirewalls = marginY + rowH * 3.5;
  const rowClients = marginY + rowH * 4.5;

  if (dnsNode) {
    result.push({ x: cx, y: rowDNS, node: dnsNode });
  }

  if (coreRouter) {
    result.push({ x: cx, y: rowCore, node: coreRouter });
  }

  if (subnetIds.length === 0) return result;

  const totalClients = subnetIds.reduce((sum, sid) => sum + (subnets[sid]?.clients.length || 0), 0);

  let currentX = marginX;

  for (let si = 0; si < subnetIds.length; si++) {
    const sid = subnetIds[si];
    const subnet = subnets[sid];
    const clientCount = subnet.clients.length;

    const weight = clientCount > 0 ? clientCount : 1;
    const totalWeight = totalClients > 0 ? totalClients : subnetIds.length;
    const colWidth = (weight / totalWeight) * availW;
    const colCenter = currentX + colWidth / 2;

    if (subnet.router) {
      result.push({ x: colCenter, y: rowRouters, node: subnet.router });
    }

    if (subnet.firewall) {
      result.push({ x: colCenter, y: rowFirewalls, node: subnet.firewall });
    }

    if (clientCount > 0) {
      const clientSpacing = Math.min(colWidth * 0.7 / Math.max(1, clientCount - 1), colWidth * 0.8);
      const totalClientWidth = (clientCount - 1) * clientSpacing;
      const clientStartX = colCenter - totalClientWidth / 2;

      for (let ci = 0; ci < clientCount; ci++) {
        const x = clientCount === 1 ? colCenter : clientStartX + ci * clientSpacing;
        result.push({ x, y: rowClients, node: subnet.clients[ci] });
      }
    }

    currentX += colWidth;
  }

  return result;
}

function layoutChain(nodes, width, height) {
  const cy = height / 2;
  const margin = width * 0.08;
  const step = nodes.length > 1 ? (width - margin * 2) / (nodes.length - 1) : 0;

  return nodes.map((n, i) => ({
    x: margin + step * i,
    y: cy + (i % 2 === 0 ? -20 : 20) * (nodes.length > 4 ? 1 : 0),
    node: n,
  }));
}

function layoutCircle(nodes, cx, cy, radius) {
  return nodes.map((n, i) => ({
    x: cx + radius * Math.cos((2 * Math.PI * i) / nodes.length - Math.PI / 2),
    y: cy + radius * Math.sin((2 * Math.PI * i) / nodes.length - Math.PI / 2),
    node: n,
  }));
}

function layoutStar(nodes, cx, cy, radius) {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) return [{ x: cx, y: cy, node: nodes[0] }];

  const result = [{ x: cx, y: cy, node: nodes[0] }];
  const outer = nodes.slice(1);
  const angleStep = (2 * Math.PI) / outer.length;

  for (let i = 0; i < outer.length; i++) {
    result.push({
      x: cx + radius * Math.cos(angleStep * i - Math.PI / 2),
      y: cy + radius * Math.sin(angleStep * i - Math.PI / 2),
      node: outer[i],
    });
  }
  return result;
}

function layoutTree(nodes, width, height) {
  if (nodes.length === 0) return [];
  if (nodes.length === 1) return [{ x: width / 2, y: height * 0.08, node: nodes[0] }];

  const result = [];
  const marginTop = height * 0.08;
  const marginBottom = height * 0.08;
  const availHeight = height - marginTop - marginBottom;

  const levels = Math.ceil(Math.log2(nodes.length + 1));
  const levelHeight = availHeight / (levels || 1);

  let idx = 0;
  for (let level = 0; level < levels && idx < nodes.length; level++) {
    const nodesInLevel = Math.min(Math.pow(2, level), nodes.length - idx);
    const y = marginTop + levelHeight * level;

    for (let i = 0; i < nodesInLevel && idx < nodes.length; i++) {
      const x = nodesInLevel === 1
        ? width / 2
        : (width * 0.1) + ((width * 0.8) / (nodesInLevel - 1 || 1)) * i;
      result.push({ x, y, node: nodes[idx] });
      idx++;
    }
  }
  return result;
}

function layoutGrid(nodes, width, height) {
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const rows = Math.ceil(nodes.length / cols);
  const cellW = width / (cols + 1);
  const cellH = height / (rows + 1);

  return nodes.map((n, i) => ({
    x: cellW * (i % cols + 1),
    y: cellH * (Math.floor(i / cols) + 1),
    node: n,
  }));
}

export { calculatePositions };
