function bfs(nodes, edges, srcId, dstId) {
  if (srcId === dstId) return [srcId];

  const visited = new Set([srcId]);
  const queue = [[srcId]];

  while (queue.length) {
    const path = queue.shift();
    const current = path[path.length - 1];

    for (const edge of edges) {
      let neighbor = null;
      if (edge.from === current) neighbor = edge.to;
      else if (edge.to === current) neighbor = edge.from;

      if (neighbor === null || visited.has(neighbor)) continue;
      const node = nodes.get(neighbor);
      if (!node || !node.on) continue;

      const newPath = [...path, neighbor];
      if (neighbor === dstId) return newPath;

      visited.add(neighbor);
      queue.push(newPath);
    }
  }
  return null;
}

export { bfs };
