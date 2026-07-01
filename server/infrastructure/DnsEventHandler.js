export class DnsEventHandler {
  constructor(roomManager, io) {
    this.roomManager = roomManager;
    this.io = io;
  }

  handleDnsQuery(socket, data) {
    const room = this.roomManager.getRoomByStudentSocket(socket.id);
    if (!room) {
      console.log('[Server] dns-query pero no hay room');
      return;
    }

    const sender = room.getNodeBySocket(socket.id);
    const { name } = data;
    const result = room.dnsResolve(name);

    const dnsNodeId = room.getDnsNodeId();
    const dnsPath = room.bfs(sender.id, dnsNodeId);
    const returnPath = [...dnsPath].reverse();
    const fullPath = [...dnsPath, ...returnPath.slice(1)];

    const nodeLogs = this._generateDnsLogs(room, fullPath, sender.name, name);

    this.io.to(room.code).emit('dns-query', {
      from: sender.id,
      path: fullPath,
      query: name,
      nodeLogs,
    });

    socket.emit('dns-response', {
      query: name,
      found: result.found,
      nodeId: result.nodeId || null,
      label: result.label || null,
      nodeName: result.name || null,
    });

    console.log(`[Server] DNS query en sala ${room.code}: "${name}" -> ${result.found ? result.nodeId : 'NOT FOUND'}`);
  }

  _generateDnsLogs(room, path, fromName, query) {
    const logs = [];
    const base = Date.now();
    let offset = 0;

    const dns = path.find(id => room.getNode(id)?.type === 'dns');
    const dnsNode = dns ? room.getNode(dns) : null;
    const senderNode = room.getNode(path[0]);

    for (let i = 0; i < path.length - 1; i++) {
      const currId = path[i];
      const nextId = path[i + 1];
      const curr = room.getNode(currId);
      const next = room.getNode(nextId);
      if (!curr || !next) continue;

      if (next.type === 'client') continue;

      if (curr.type === 'dns') {
        logs.push({ nodeId: currId, text: `DNS: "${query}" = ${next.name}`, type: 'dns', timestamp: base + offset });
        offset += 100;
      } else if (next.type === 'dns') {
        logs.push({ nodeId: currId, text: `${curr.name} → ${next.name}: consulta "${query}"`, type: curr.type, timestamp: base + offset });
        offset += 100;
      } else if (curr.type === 'firewall') {
        logs.push({ nodeId: currId, text: `${curr.name}: Permitida ${senderNode?.name || '?'} → ${next.name}`, type: 'firewall', timestamp: base + offset });
        offset += 100;
      } else if (next.type === 'firewall') {
        logs.push({ nodeId: currId, text: `${curr.name} → ${next.name}: consulta "${query}"`, type: curr.type, timestamp: base + offset });
        offset += 100;
      } else {
        const isResponse = dnsNode && (i > path.indexOf(dns));
        if (isResponse) {
          logs.push({ nodeId: currId, text: `${curr.name} → ${next.name}: respuesta "${query}"`, type: curr.type, timestamp: base + offset });
        } else {
          logs.push({ nodeId: currId, text: `${curr.name} → ${next.name}: consulta "${query}"`, type: curr.type, timestamp: base + offset });
        }
        offset += 100;
      }
    }

    return logs;
  }
}
