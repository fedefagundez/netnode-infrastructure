class NetworkClient {
  constructor() {
    this.socket = null;
    this.myNodeId = null;
    this.myLabel = null;
    this.mySubnetId = null;
    this.state = { nodes: [], edges: [] };
    this.roomCode = null;
    this.connected = false;

    this.onStateUpdate = null;
    this.onPacket = null;
    this.onReceiveMessage = null;
    this.onMessageError = null;
    this.onRoomCreated = null;
    this.onRoomJoined = null;
    this.onError = null;
    this.onRoomClosed = null;
    this.onDnsResponse = null;
    this.onFirewallRules = null;
  }

  connect() {
    this.socket = io('/', { transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: 10, reconnectionDelay: 1000 });

    this.socket.on('connect', () => {
      console.log('[Client] Conectado al servidor');
      this.connected = true;
    });

    this.socket.on('connect_error', (err) => {
      console.error('[Client] Error de conexion:', err.message);
      this.connected = false;
    });

    this.socket.on('room-created', (data) => {
      if (this.onRoomCreated) this.onRoomCreated(data);
    });

    this.socket.on('room-joined', (data) => {
      this.myNodeId = data.nodeId;
      this.myLabel = data.label;
      this.mySubnetId = data.subnetId;
      this.state = data.state;
      this.roomCode = data.state.code;
      if (this.onRoomJoined) this.onRoomJoined(data);
    });

    this.socket.on('state-update', (newState) => {
      this.state = newState;
      if (this.onStateUpdate) this.onStateUpdate(newState);
    });

    this.socket.on('packet', (data) => {
      if (this.onPacket) this.onPacket(data);
    });

    this.socket.on('receive-message', (data) => {
      if (this.onReceiveMessage) this.onReceiveMessage(data);
    });

    this.socket.on('message-error', (data) => {
      if (this.onMessageError) this.onMessageError(data);
    });

    this.socket.on('dns-response', (data) => {
      if (this.onDnsResponse) this.onDnsResponse(data);
    });

    this.socket.on('firewall-rules', (data) => {
      if (this.onFirewallRules) this.onFirewallRules(data);
    });

    this.socket.on('error', (data) => {
      if (this.onError) this.onError(data);
    });

    this.socket.on('room-closed', (data) => {
      if (this.onRoomClosed) this.onRoomClosed(data);
    });

    this.socket.on('disconnect', () => {
      console.log('[Client] Desconectado del servidor');
    });
  }

  createRoom(groupName, teacherName) {
    this.socket.emit('create-room', { groupName, teacherName });
  }

  joinRoom(code, name) {
    this.socket.emit('join-room', { code, name });
  }

  dnsQuery(name) {
    this.socket.emit('dns-query', { name });
  }

  sendMessage(toNodeId, text) {
    this.socket.emit('send-message', { toNodeId, text });
  }

  toggleNode() {
    this.socket.emit('toggle-node');
  }

  setFirewallRules(firewallId, rules) {
    this.socket.emit('set-firewall-rules', { firewallId, rules });
  }

  getFirewallRules(firewallId) {
    this.socket.emit('get-firewall-rules', { firewallId });
  }

  getMyNodeId() {
    return this.myNodeId;
  }

  getMyLabel() {
    return this.myLabel;
  }

  getMySubnetId() {
    return this.mySubnetId;
  }

  getState() {
    return this.state;
  }

  getOtherNodes() {
    return this.state.nodes.filter(n => n.id !== this.myNodeId && n.type === 'client');
  }
}

export { NetworkClient };
