import { bfs } from './pathfinding.js';
import { MessageLog } from './MessageLog.js';

class Room {
  constructor(code, groupName, teacherSocketId) {
    this.code = code;
    this.groupName = groupName;
    this.teacherSocketId = teacherSocketId;
    this.nodes = new Map();
    this.edges = [];
    this.messageLog = new MessageLog();
    this.nextNodeId = 0;
    this.alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    this.createdAt = new Date();
    this.topology = 'school-network';
    this.subnets = [];
    this.dnsTable = {};
    this.firewallRules = {};
    this.nodeSubnetMap = new Map();
    this.clientLabelIdx = 0;
  }

  addInfrastructureNode(type, name) {
    const id = this.nextNodeId++;
    const node = {
      id,
      label: '',
      name,
      socketId: null,
      type,
      on: true,
      isInfrastructure: true,
      subnetId: null,
    };
    this.nodes.set(id, node);
    return node;
  }

  addClientNode(name, socketId) {
    const subnetId = this._assignSubnet();
    this._ensureSubnet(subnetId);

    const id = this.nextNodeId++;
    const label = this.alphabet[this.clientLabelIdx] || String(this.clientLabelIdx);
    this.clientLabelIdx++;
    const subnet = this.subnets[subnetId];

    const node = {
      id,
      label,
      name,
      socketId,
      type: 'client',
      on: true,
      isInfrastructure: false,
      subnetId,
    };

    this.nodes.set(id, node);
    this.nodeSubnetMap.set(id, subnetId);
    subnet.clients.push(id);

    this.addEdge(subnet.firewallId, id);

    this.dnsTable[name.toLowerCase()] = id;

    return node;
  }

  _assignSubnet() {
    for (let i = 0; i < this.subnets.length; i++) {
      if (this.subnets[i].clients.length < 3) {
        return i;
      }
    }
    return this.subnets.length;
  }

  _ensureSubnet(subnetId) {
    if (this.subnets[subnetId]) return;

    const centralRouter = Array.from(this.nodes.values()).find(
      n => n.type === 'router' && n.subnetId == null
    );

    const localRouter = this.addInfrastructureNode('router', `Router ${subnetId + 1}`);
    const firewall = this.addInfrastructureNode('firewall', `Firewall ${subnetId + 1}`);

    this.addEdge(centralRouter.id, localRouter.id);
    this.addEdge(localRouter.id, firewall.id);

    this.subnets.push({
      id: subnetId,
      routerId: localRouter.id,
      firewallId: firewall.id,
      clients: [],
    });

    this.nodes.get(localRouter.id).subnetId = subnetId;
    this.nodes.get(firewall.id).subnetId = subnetId;
  }

  createSubnets() {
    this.subnets = [];
    this.edges = [];

    this.addInfrastructureNode('dns', 'DNS');
    const centralRouter = this.addInfrastructureNode('router', 'Router Central');
    const dnsNode = Array.from(this.nodes.values()).find(n => n.type === 'dns');
    this.addEdge(dnsNode.id, centralRouter.id);
  }

  addNode(name, socketId) {
    return this.addClientNode(name, socketId);
  }

  removeNode(socketId) {
    for (const [id, node] of this.nodes) {
      if (node.socketId === socketId) {
        this.nodes.delete(id);
        this.edges = this.edges.filter(e => e.from !== id && e.to !== id);

        if (node.subnetId !== null && this.subnets[node.subnetId]) {
          const subnet = this.subnets[node.subnetId];
          subnet.clients = subnet.clients.filter(cid => cid !== id);
        }

        delete this.dnsTable[node.name.toLowerCase()];
        this.nodeSubnetMap.delete(id);
        return node;
      }
    }
    return null;
  }

  getNode(id) {
    return this.nodes.get(id) || null;
  }

  getNodeBySocket(socketId) {
    for (const node of this.nodes.values()) {
      if (node.socketId === socketId) return node;
    }
    return null;
  }

  toggleNode(id) {
    const node = this.nodes.get(id);
    if (node) {
      node.on = !node.on;
      return node;
    }
    return null;
  }

  addEdge(fromId, toId) {
    if (this.edges.some(e => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId))) {
      return false;
    }
    this.edges.push({ from: fromId, to: toId });
    return true;
  }

  removeEdge(fromId, toId) {
    this.edges = this.edges.filter(
      e => !((e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId))
    );
  }

  dnsResolve(name) {
    const normalizedName = name.toLowerCase().trim();
    const nodeId = this.dnsTable[normalizedName];
    if (nodeId !== undefined) {
      const node = this.nodes.get(nodeId);
      return { found: true, nodeId, label: node.label, name: node.name };
    }
    return { found: false };
  }

  getDnsNodeId() {
    for (const [id, node] of this.nodes) {
      if (node.type === 'dns') return id;
    }
    return null;
  }

  checkFirewall(srcId, dstId) {
    const srcNode = this.nodes.get(srcId);
    const dstNode = this.nodes.get(dstId);
    if (!srcNode || !dstNode) return { allowed: false, reason: 'nodo-no-existe' };

    if (srcNode.subnetId === dstNode.subnetId) {
      return { allowed: true };
    }

    const srcSubnet = this.subnets[srcNode.subnetId];
    const dstSubnet = this.subnets[dstNode.subnetId];

    if (srcSubnet) {
      const srcRules = this.firewallRules[srcSubnet.firewallId] || {};
      if (srcRules.blockedNodes && srcRules.blockedNodes.includes(dstId)) {
        return { allowed: false, reason: 'firewall-bloqueado', firewallName: this.nodes.get(srcSubnet.firewallId).name, firewallId: srcSubnet.firewallId };
      }
    }

    if (dstSubnet) {
      const dstRules = this.firewallRules[dstSubnet.firewallId] || {};
      if (dstRules.blockedNodes && dstRules.blockedNodes.includes(srcId)) {
        return { allowed: false, reason: 'firewall-bloqueado', firewallName: this.nodes.get(dstSubnet.firewallId).name, firewallId: dstSubnet.firewallId };
      }
    }

    return { allowed: true };
  }

  setFirewallRules(firewallId, rules) {
    this.firewallRules[firewallId] = rules;
  }

  getFirewallRules(firewallId) {
    return this.firewallRules[firewallId] || {};
  }

  bfs(srcId, dstId) {
    return bfs(this.nodes, this.edges, srcId, dstId);
  }

  logMessage(fromId, toId, text) {
    this.messageLog.log(fromId, toId, text);
  }

  getChatLog(nodeA, nodeB) {
    return this.messageLog.getChatLog(nodeA, nodeB);
  }

  getAllChats() {
    return this.messageLog.getAllChats();
  }

  getChatPairs() {
    const pairs = new Map();
    const clientNodes = Array.from(this.nodes.values()).filter(n => n.type === 'client');
    for (const node of clientNodes) {
      for (const node2 of clientNodes) {
        if (node.id < node2.id) {
          const key = `${node.id}-${node2.id}`;
          if (!pairs.has(key)) {
            pairs.set(key, {
              a: { id: node.id, label: node.label, name: node.name, subnetId: node.subnetId },
              b: { id: node2.id, label: node2.label, name: node2.name, subnetId: node2.subnetId },
            });
          }
        }
      }
    }
    return Array.from(pairs.values());
  }

  getState() {
    return {
      code: this.code,
      groupName: this.groupName,
      topology: this.topology,
      nodes: Array.from(this.nodes.values()),
      edges: this.edges,
      nodeCount: this.nodes.size,
      subnets: this.subnets.map(s => ({
        id: s.id,
        routerId: s.routerId,
        firewallId: s.firewallId,
        clientCount: s.clients.length,
      })),
      dnsTable: this.dnsTable,
      firewallRules: this.firewallRules,
    };
  }

  nodeCount() {
    return this.nodes.size;
  }
}

export { Room };
