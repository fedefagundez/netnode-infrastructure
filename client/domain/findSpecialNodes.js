function findSpecialNodes(nodes) {
  const routerCentral = nodes.find(n => n.type === 'router' && n.subnetId == null);
  const dns = nodes.find(n => n.type === 'dns');
  return { routerCentral, dns };
}

export { findSpecialNodes };
