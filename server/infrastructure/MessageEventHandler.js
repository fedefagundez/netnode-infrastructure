export class MessageEventHandler {
  constructor(roomManager, io) {
    this.roomManager = roomManager;
    this.io = io;
  }

  handleSendMessage(socket, data) {
    const room = this.roomManager.getRoomByStudentSocket(socket.id);
    if (!room) return;

    const sender = room.getNodeBySocket(socket.id);
    if (!sender) return;

    const receiver = room.getNode(data.toNodeId);
    if (!receiver) {
      socket.emit('message-error', { reason: 'receptor-no-existe' });
      return;
    }

    if (!receiver.on) {
      socket.emit('message-error', { reason: 'receptor-apagado', receiverName: receiver.name });
      return;
    }

    const firewallCheck = room.checkFirewall(sender.id, receiver.id);
    if (!firewallCheck.allowed) {
      socket.emit('message-error', {
        reason: firewallCheck.reason,
        receiverName: receiver.name,
        firewallName: firewallCheck.firewallName,
        firewallId: firewallCheck.firewallId,
      });
      this.io.to(room.code).emit('firewall-decision', {
        firewallId: firewallCheck.firewallId,
        decision: 'reject',
        fromId: sender.id,
        fromName: sender.name,
        toId: receiver.id,
        toName: receiver.name,
      });
      console.log(`[Server] Firewall bloqueo mensaje en sala ${room.code}: ${sender.name} -> ${receiver.name} (${firewallCheck.firewallName})`);
      return;
    }

    const path = room.bfs(sender.id, receiver.id);
    if (!path) {
      socket.emit('message-error', { reason: 'sin-ruta', receiverName: receiver.name });
      return;
    }

    room.logMessage(sender.id, receiver.id, data.text);

    const specialNodes = path
      .map(id => room.getNode(id))
      .filter(n => n && n.type && n.type !== 'client')
      .map(n => ({ id: n.id, type: n.type, name: n.name }));

    const nodeLogs = this._generateNodeLogs(room, path, sender.name, receiver.name);

    const packetData = {
      from: sender.id,
      to: receiver.id,
      path: path,
      text: data.text,
      specialNodes,
      nodeLogs,
    };

    this.io.to(room.code).emit('packet', packetData);
    this.io.to(room.teacherSocketId).emit('packet', packetData);

    this.io.to(receiver.socketId).emit('receive-message', {
      from: sender.id,
      fromLabel: sender.label,
      fromName: sender.name,
      toNodeId: receiver.id,
      text: data.text,
      timestamp: Date.now(),
    });

    this.io.to(room.teacherSocketId).emit('room-message', {
      from: sender.name,
      fromLabel: sender.label,
      to: receiver.name,
      toLabel: receiver.label,
      text: data.text,
      timestamp: Date.now(),
    });
  }

  _generateNodeLogs(room, path, fromName, toName) {
    const logs = [];
    const base = Date.now();
    let offset = 0;

    const dns = path.find(id => room.getNode(id)?.type === 'dns');
    const dnsNode = dns ? room.getNode(dns) : null;

    for (let i = 0; i < path.length - 1; i++) {
      const currId = path[i];
      const nextId = path[i + 1];
      const curr = room.getNode(currId);
      const next = room.getNode(nextId);
      if (!curr || !next) continue;

      if (next.type === 'client') continue;

      if (curr.type === 'firewall') {
        logs.push({ nodeId: currId, text: `${curr.name}: Permitida ${fromName} → ${toName}`, type: 'firewall', timestamp: base + offset });
        offset += 100;
      } else if (next.type === 'firewall') {
        logs.push({ nodeId: currId, text: `${curr.name} → ${next.name}: ${fromName} → ${toName}`, type: curr.type, timestamp: base + offset });
        offset += 100;
      } else if (curr.type === 'dns') {
        logs.push({ nodeId: currId, text: `DNS: "${toName}" = ${next.name}`, type: 'dns', timestamp: base + offset });
        offset += 100;
      } else if (next.type === 'dns') {
        logs.push({ nodeId: currId, text: `${curr.name} → ${next.name}: consulta "${toName}"`, type: curr.type, timestamp: base + offset });
        offset += 100;
      } else if (curr.type !== 'client') {
        const isResponse = dnsNode && (i > path.indexOf(dns));
        if (isResponse) {
          logs.push({ nodeId: currId, text: `${curr.name} → ${next.name}: respuesta "${toName}"`, type: curr.type, timestamp: base + offset });
        } else {
          logs.push({ nodeId: currId, text: `${curr.name} → ${next.name}: ${fromName} → ${toName}`, type: curr.type, timestamp: base + offset });
        }
        offset += 100;
      }
    }

    return logs;
  }
}
