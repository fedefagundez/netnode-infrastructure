class TopologyBuilder {
  static buildIncremental(topology, existingIds, newId, edges, nodeMap) {
    if (existingIds.length === 0) return;

    switch (topology) {
      case 'chain':
        edges.push({ from: existingIds[existingIds.length - 1], to: newId });
        break;

      case 'star':
        edges.push({ from: existingIds[0], to: newId });
        break;

      case 'ring':
        if (existingIds.length === 1) {
          edges.push({ from: existingIds[0], to: newId });
        } else {
          edges.push({ from: existingIds[existingIds.length - 1], to: newId });
          edges.push({ from: newId, to: existingIds[0] });
        }
        break;

      case 'tree':
        if (existingIds.length <= 1) {
          edges.push({ from: existingIds[0], to: newId });
        } else {
          const nodeIndex = existingIds.length;
          const parentIndex = Math.floor((nodeIndex - 1) / 2);
          edges.push({ from: existingIds[parentIndex], to: newId });
        }
        break;

      case 'mesh-partial': {
        const count = Math.min(existingIds.length, 2 + Math.floor(Math.random() * 2));
        const shuffled = [...existingIds].sort(() => Math.random() - 0.5);
        for (let i = 0; i < count; i++) {
          edges.push({ from: shuffled[i], to: newId });
        }
        break;
      }

      case 'mesh-full':
        for (const id of existingIds) {
          edges.push({ from: id, to: newId });
        }
        break;

      case 'small-world': {
        const cols = Math.ceil(Math.sqrt(existingIds.length + 1));
        const idx = existingIds.length;
        const row = Math.floor(idx / cols);
        const col = idx % cols;

        if (col > 0) {
          const left = idx - 1;
          if (existingIds.includes(left)) edges.push({ from: left, to: newId });
        }
        if (row > 0) {
          const up = idx - cols;
          if (existingIds.includes(up)) edges.push({ from: up, to: newId });
        }
        if (Math.random() < 0.2 && existingIds.length > 2) {
          const others = existingIds.filter(id => id !== newId);
          const rand = others[Math.floor(Math.random() * others.length)];
          if (!TopologyBuilder._edgeExists(edges, newId, rand)) {
            edges.push({ from: rand, to: newId });
          }
        }
        break;
      }

      case 'scale-free': {
        const degrees = new Map();
        for (const id of existingIds) degrees.set(id, 0);
        for (const e of edges) {
          if (degrees.has(e.from)) degrees.set(e.from, degrees.get(e.from) + 1);
          if (degrees.has(e.to)) degrees.set(e.to, degrees.get(e.to) + 1);
        }
        const totalDegree = Array.from(degrees.values()).reduce((a, b) => a + b, 0) || 1;
        const connections = Math.min(3, existingIds.length);
        for (let c = 0; c < connections; c++) {
          let rand = Math.random() * totalDegree;
          for (const [id, deg] of degrees) {
            rand -= deg + 1;
            if (rand <= 0) {
              if (!TopologyBuilder._edgeExists(edges, newId, id)) {
                edges.push({ from: id, to: newId });
              }
              break;
            }
          }
        }
        break;
      }

      case 'random':
        for (const id of existingIds) {
          if (Math.random() < 0.3) {
            edges.push({ from: id, to: newId });
          }
        }
        if (!edges.some(e => e.from === newId || e.to === newId)) {
          const rand = existingIds[Math.floor(Math.random() * existingIds.length)];
          edges.push({ from: rand, to: newId });
        }
        break;

      case 'grid': {
        const cols = Math.ceil(Math.sqrt(existingIds.length + 1));
        const idx = existingIds.length;
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        if (col > 0) {
          const left = idx - 1;
          if (existingIds.includes(left)) edges.push({ from: left, to: newId });
        }
        if (row > 0) {
          const up = idx - cols;
          if (existingIds.includes(up)) edges.push({ from: up, to: newId });
        }
        break;
      }
    }
  }

  static buildFull(topology, ids) {
    const edges = [];

    switch (topology) {
      case 'chain':
        for (let i = 0; i < ids.length - 1; i++) {
          edges.push({ from: ids[i], to: ids[i + 1] });
        }
        break;

      case 'star':
        for (let i = 1; i < ids.length; i++) {
          edges.push({ from: ids[0], to: ids[i] });
        }
        break;

      case 'ring':
        for (let i = 0; i < ids.length; i++) {
          edges.push({ from: ids[i], to: ids[(i + 1) % ids.length] });
        }
        break;

      case 'tree':
        TopologyBuilder._buildTree(ids, edges);
        break;

      case 'mesh-partial':
        for (const id of ids) {
          const others = ids.filter(x => x !== id);
          const count = Math.min(others.length, 2 + Math.floor(Math.random() * 2));
          const shuffled = [...others].sort(() => Math.random() - 0.5);
          for (let i = 0; i < count; i++) {
            if (!TopologyBuilder._edgeExists(edges, id, shuffled[i])) {
              edges.push({ from: id, to: shuffled[i] });
            }
          }
        }
        break;

      case 'mesh-full':
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            edges.push({ from: ids[i], to: ids[j] });
          }
        }
        break;

      case 'small-world':
        TopologyBuilder._buildSmallWorld(ids, edges);
        break;

      case 'scale-free':
        TopologyBuilder._buildScaleFree(ids, edges);
        break;

      case 'random':
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            if (Math.random() < 0.3) {
              edges.push({ from: ids[i], to: ids[j] });
            }
          }
        }
        for (const id of ids) {
          if (!edges.some(e => e.from === id || e.to === id)) {
            const others = ids.filter(x => x !== id);
            const rand = others[Math.floor(Math.random() * others.length)];
            edges.push({ from: id, to: rand });
          }
        }
        break;

      case 'grid':
        TopologyBuilder._buildGrid(ids, edges);
        break;
    }

    return edges;
  }

  static _buildTree(ids, edges) {
    if (ids.length <= 1) return;
    const levels = Math.ceil(Math.log2(ids.length + 1));
    let idx = 0;
    const levelNodes = [];

    for (let level = 0; level < levels && idx < ids.length; level++) {
      const count = Math.min(Math.pow(2, level), ids.length - idx);
      const levelArr = [];
      for (let i = 0; i < count && idx < ids.length; i++) {
        levelArr.push(ids[idx]);
        idx++;
      }
      levelNodes.push(levelArr);
    }

    for (let level = 1; level < levelNodes.length; level++) {
      for (let i = 0; i < levelNodes[level].length; i++) {
        const parentIdx = Math.floor(i / 2);
        if (parentIdx < levelNodes[level - 1].length) {
          edges.push({ from: levelNodes[level - 1][parentIdx], to: levelNodes[level][i] });
        }
      }
    }
  }

  static _buildSmallWorld(ids, edges) {
    const cols = Math.ceil(Math.sqrt(ids.length));
    for (let i = 0; i < ids.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      if (col < cols - 1 && i + 1 < ids.length) {
        edges.push({ from: ids[i], to: ids[i + 1] });
      }
      if (row * cols + col + cols < ids.length) {
        edges.push({ from: ids[i], to: ids[i + cols] });
      }
    }
    for (let i = 0; i < ids.length; i++) {
      if (Math.random() < 0.2) {
        const others = ids.filter(x => x !== ids[i]);
        const rand = others[Math.floor(Math.random() * others.length)];
        if (!TopologyBuilder._edgeExists(edges, ids[i], rand)) {
          edges.push({ from: ids[i], to: rand });
        }
      }
    }
  }

  static _buildScaleFree(ids, edges) {
    if (ids.length < 2) return;
    edges.push({ from: ids[0], to: ids[1] });

    for (let i = 2; i < ids.length; i++) {
      const degrees = new Map();
      for (const id of ids.slice(0, i)) degrees.set(id, 0);
      for (const e of edges) {
        if (degrees.has(e.from)) degrees.set(e.from, degrees.get(e.from) + 1);
        if (degrees.has(e.to)) degrees.set(e.to, degrees.get(e.to) + 1);
      }
      const total = Array.from(degrees.values()).reduce((a, b) => a + b, 0) || 1;
      let rand = Math.random() * total;
      for (const [id, deg] of degrees) {
        rand -= deg + 1;
        if (rand <= 0) {
          edges.push({ from: id, to: ids[i] });
          break;
        }
      }
    }
  }

  static _buildGrid(ids, edges) {
    const cols = Math.ceil(Math.sqrt(ids.length));
    for (let i = 0; i < ids.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      if (col < cols - 1 && i + 1 < ids.length) {
        edges.push({ from: ids[i], to: ids[i + 1] });
      }
      if (row * cols + col + cols < ids.length) {
        edges.push({ from: ids[i], to: ids[i + cols] });
      }
    }
  }

  static _edgeExists(edges, a, b) {
    return edges.some(
      e => (e.from === a && e.to === b) || (e.from === b && e.to === a)
    );
  }

  static getInfrastructureForTopology(topology) {
    switch (topology) {
      case 'chain':
        return [
          { type: 'dns', name: 'DNS' },
        ];
      case 'ring':
        return [
          { type: 'router', name: 'Router Centro' },
        ];
      case 'star':
        return [
          { type: 'router', name: 'Router Central' },
          { type: 'dns', name: 'DNS' },
        ];
      case 'tree':
        return [
          { type: 'router', name: 'Router Raiz' },
          { type: 'dns', name: 'DNS' },
          { type: 'firewall', name: 'Firewall' },
        ];
      case 'mesh-partial':
      case 'mesh-full':
        return [
          { type: 'router', name: 'Router 1' },
          { type: 'router', name: 'Router 2' },
          { type: 'dns', name: 'DNS' },
        ];
      case 'small-world':
      case 'scale-free':
        return [
          { type: 'router', name: 'Router Hub' },
          { type: 'dns', name: 'DNS' },
          { type: 'firewall', name: 'Firewall' },
        ];
      case 'random':
        return [
          { type: 'dns', name: 'DNS' },
        ];
      case 'grid':
        return [
          { type: 'router', name: 'Router' },
          { type: 'dns', name: 'DNS' },
        ];
      default:
        return [];
    }
  }
}

export { TopologyBuilder };
