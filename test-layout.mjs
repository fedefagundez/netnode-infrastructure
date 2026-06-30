function calculatePositions(nodes, width, height, topology) {
  if (nodes.length === 0) return [];
  switch (topology) {
    case 'school-network':
      return layoutSchoolNetwork(nodes, width, height);
    default:
      return [];
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

const W = 1200;
const H = 800;

function makeNode(id, type, subnetId = null) {
  return { id, type, subnetId, label: String.fromCharCode(65 + id), name: `${type}-${id}` };
}

function assert(condition, msg) {
  if (!condition) {
    console.error(`  FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`  OK: ${msg}`);
  }
}

function assertNoOverlap(positions, minDist) {
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i];
      const b = positions[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        console.error(`  FAIL: Nodes "${a.node.label}" (${a.node.type}) and "${b.node.label}" (${b.node.type}) overlap: dist=${dist.toFixed(1)} < ${minDist}`);
        console.error(`    A: (${a.x.toFixed(1)}, ${a.y.toFixed(1)})`);
        console.error(`    B: (${b.x.toFixed(1)}, ${b.y.toFixed(1)})`);
        process.exitCode = 1;
      }
    }
  }
}

function assertBounds(positions, w, h) {
  for (const p of positions) {
    if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
      console.error(`  FAIL: Node "${p.node.label}" out of bounds: (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) in ${w}x${h}`);
      process.exitCode = 1;
    }
  }
}

function assertHierarchy(positions, w, h) {
  const cx = w / 2;
  const cy = h / 2;

  const byType = {};
  for (const p of positions) {
    const key = p.node.type + (p.node.subnetId != null ? ':' + p.node.subnetId : '');
    if (!byType[key]) byType[key] = [];
    byType[key].push(p);
  }

  const dns = byType['dns']?.[0];
  const coreRouter = byType['router:undefined']?.[0];
  if (dns && coreRouter) {
    const dnsDist = Math.hypot(dns.x - cx, dns.y - cy);
    const coreDist = Math.hypot(coreRouter.x - cx, coreRouter.y - cy);
    assert(dnsDist < coreDist, 'DNS closer to center than Core Router');
  }

  for (const key of Object.keys(byType)) {
    if (key.startsWith('router:') && key !== 'router:undefined') {
      const sid = key.split(':')[1];
      const router = byType[key][0];
      const firewall = byType['firewall:' + sid]?.[0];
      if (firewall) {
        const rDist = Math.hypot(router.x - cx, router.y - cy);
        const fDist = Math.hypot(firewall.x - cx, firewall.y - cy);
        assert(fDist > rDist * 0.9, `Firewall subnet ${sid} farther from center than Router subnet ${sid} (fw=${fDist.toFixed(0)} vs rt=${rDist.toFixed(0)})`);
      }
    }
  }
}

// Test 1: 3 subnets, 0 clients
console.log('\n=== Test 1: 3 subnets, 0 clients ===');
{
  const nodes = [
    makeNode(0, 'dns'),
    makeNode(1, 'router'),
    makeNode(2, 'router', 0),
    makeNode(3, 'firewall', 0),
    makeNode(4, 'router', 1),
    makeNode(5, 'firewall', 1),
    makeNode(6, 'router', 2),
    makeNode(7, 'firewall', 2),
  ];
  const pos = calculatePositions(nodes, W, H, 'school-network');
  assert(pos.length === 8, `Expected 8 positions, got ${pos.length}`);
  assertNoOverlap(pos, 40);
  assertBounds(pos, W, H);
  assertHierarchy(pos, W, H);
}

// Test 2: 3 subnets, 2 clients each
console.log('\n=== Test 2: 3 subnets, 2 clients each ===');
{
  const nodes = [
    makeNode(0, 'dns'),
    makeNode(1, 'router'),
    makeNode(2, 'router', 0), makeNode(3, 'firewall', 0),
    makeNode(4, 'router', 1), makeNode(5, 'firewall', 1),
    makeNode(6, 'router', 2), makeNode(7, 'firewall', 2),
    makeNode(8, 'client', 0), makeNode(9, 'client', 0),
    makeNode(10, 'client', 1), makeNode(11, 'client', 1),
    makeNode(12, 'client', 2), makeNode(13, 'client', 2),
  ];
  const pos = calculatePositions(nodes, W, H, 'school-network');
  assert(pos.length === 14, `Expected 14 positions, got ${pos.length}`);
  assertNoOverlap(pos, 35);
  assertBounds(pos, W, H);
  assertHierarchy(pos, W, H);
}

// Test 3: 1 subnet, 5 clients
console.log('\n=== Test 3: 1 subnet, 5 clients ===');
{
  const nodes = [
    makeNode(0, 'dns'),
    makeNode(1, 'router'),
    makeNode(2, 'router', 0), makeNode(3, 'firewall', 0),
    makeNode(4, 'client', 0), makeNode(5, 'client', 0),
    makeNode(6, 'client', 0), makeNode(7, 'client', 0), makeNode(8, 'client', 0),
  ];
  const pos = calculatePositions(nodes, W, H, 'school-network');
  assert(pos.length === 9, `Expected 9 positions, got ${pos.length}`);
  assertNoOverlap(pos, 35);
  assertBounds(pos, W, H);
  assertHierarchy(pos, W, H);
}

// Test 4: 5 subnets, 3 clients each (max)
console.log('\n=== Test 4: 5 subnets, 3 clients each ===');
{
  const nodes = [
    makeNode(0, 'dns'),
    makeNode(1, 'router'),
  ];
  let id = 2;
  for (let s = 0; s < 5; s++) {
    nodes.push(makeNode(id++, 'router', s));
    nodes.push(makeNode(id++, 'firewall', s));
    for (let c = 0; c < 3; c++) {
      nodes.push(makeNode(id++, 'client', s));
    }
  }
  const pos = calculatePositions(nodes, W, H, 'school-network');
  assert(pos.length === 27, `Expected 27 positions, got ${pos.length}`);
  assertNoOverlap(pos, 30);
  assertBounds(pos, W, H);
  assertHierarchy(pos, W, H);
}

// Test 5: 2 subnets, different client counts
console.log('\n=== Test 5: 2 subnets, asymmetric clients ===');
{
  const nodes = [
    makeNode(0, 'dns'),
    makeNode(1, 'router'),
    makeNode(2, 'router', 0), makeNode(3, 'firewall', 0),
    makeNode(4, 'client', 0),
    makeNode(5, 'router', 1), makeNode(6, 'firewall', 1),
    makeNode(7, 'client', 1), makeNode(8, 'client', 1), makeNode(9, 'client', 1),
  ];
  const pos = calculatePositions(nodes, W, H, 'school-network');
  assert(pos.length === 10, `Expected 10 positions, got ${pos.length}`);
  assertNoOverlap(pos, 35);
  assertBounds(pos, W, H);
  assertHierarchy(pos, W, H);
}

// Test 6: Small canvas
console.log('\n=== Test 6: Small canvas (600x400) ===');
{
  const nodes = [
    makeNode(0, 'dns'),
    makeNode(1, 'router'),
    makeNode(2, 'router', 0), makeNode(3, 'firewall', 0),
    makeNode(4, 'client', 0), makeNode(5, 'client', 0),
  ];
  const pos = calculatePositions(nodes, 600, 400, 'school-network');
  assert(pos.length === 6, `Expected 6 positions, got ${pos.length}`);
  assertNoOverlap(pos, 30);
  assertBounds(pos, 600, 400);
}

// Test 7: Wide canvas
console.log('\n=== Test 7: Wide canvas (1920x1080) ===');
{
  const nodes = [
    makeNode(0, 'dns'),
    makeNode(1, 'router'),
    makeNode(2, 'router', 0), makeNode(3, 'firewall', 0),
    makeNode(4, 'client', 0), makeNode(5, 'client', 0),
    makeNode(6, 'router', 1), makeNode(7, 'firewall', 1),
    makeNode(8, 'client', 1), makeNode(9, 'client', 1),
  ];
  const pos = calculatePositions(nodes, 1920, 1080, 'school-network');
  assert(pos.length === 10, `Expected 10 positions, got ${pos.length}`);
  assertNoOverlap(pos, 40);
  assertBounds(pos, 1920, 1080);
  assertHierarchy(pos, 1920, 1080);
}

// Test 8: Single subnet, many clients
console.log('\n=== Test 8: 1 subnet, 10 clients ===');
{
  const nodes = [
    makeNode(0, 'dns'),
    makeNode(1, 'router'),
    makeNode(2, 'router', 0), makeNode(3, 'firewall', 0),
  ];
  for (let i = 0; i < 10; i++) {
    nodes.push(makeNode(4 + i, 'client', 0));
  }
  const pos = calculatePositions(nodes, W, H, 'school-network');
  assert(pos.length === 14, `Expected 14 positions, got ${pos.length}`);
  assertNoOverlap(pos, 25);
  assertBounds(pos, W, H);
}

if (process.exitCode) {
  console.error('\nSome tests FAILED');
} else {
  console.log('\nAll tests PASSED');
}

// Visual dump for debugging
console.log('\n=== Coordinates (Test 4: 5 subnets, 3 clients each, 1200x800) ===');
{
  const nodes = [
    makeNode(0, 'dns'),
    makeNode(1, 'router'),
  ];
  let id = 2;
  for (let s = 0; s < 5; s++) {
    nodes.push(makeNode(id++, 'router', s));
    nodes.push(makeNode(id++, 'firewall', s));
    for (let c = 0; c < 3; c++) {
      nodes.push(makeNode(id++, 'client', s));
    }
  }
  const pos = calculatePositions(nodes, W, H, 'school-network');
  for (const p of pos) {
    console.log(`  ${p.node.type.padEnd(10)} ${p.node.label}  x=${p.x.toFixed(0).padStart(4)}  y=${p.y.toFixed(0).padStart(4)}  subnet=${p.node.subnetId ?? '-'}`);
  }
}

console.log('\n=== Coordinates (Test 2: 3 subnets, 2 clients each) ===');
{
  const nodes = [
    makeNode(0, 'dns'),
    makeNode(1, 'router'),
    makeNode(2, 'router', 0), makeNode(3, 'firewall', 0),
    makeNode(4, 'router', 1), makeNode(5, 'firewall', 1),
    makeNode(6, 'router', 2), makeNode(7, 'firewall', 2),
    makeNode(8, 'client', 0), makeNode(9, 'client', 0),
    makeNode(10, 'client', 1), makeNode(11, 'client', 1),
    makeNode(12, 'client', 2), makeNode(13, 'client', 2),
  ];
  const pos = calculatePositions(nodes, W, H, 'school-network');
  for (const p of pos) {
    console.log(`  ${p.node.type.padEnd(10)} ${p.node.label}  x=${p.x.toFixed(0).padStart(4)}  y=${p.y.toFixed(0).padStart(4)}  subnet=${p.node.subnetId ?? '-'}`);
  }
}
