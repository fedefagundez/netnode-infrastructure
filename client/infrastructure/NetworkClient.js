class NetworkClient {
  static EVENT_CALLBACKS = {
    'room-created': 'onRoomCreated',
    'state-update': 'onStateUpdate',
    'packet': 'onPacket',
    'receive-message': 'onReceiveMessage',
    'message-error': 'onMessageError',
    'dns-response': 'onDnsResponse',
    'dns-query': 'onDnsQuery',
    'firewall-rules': 'onFirewallRules',
    'firewall-decision': 'onFirewallDecision',
    'error': 'onError',
    'room-closed': 'onRoomClosed',
  };

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
    this.onDnsQuery = null;
    this.onFirewallRules = null;
    this.onFirewallDecision = null;
  }

  _emitCallback(name, data) {
    const callback = this[name];
    if (callback) callback(data);
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

    this.socket.on('room-joined', (data) => {
      this.myNodeId = data.nodeId;
      this.myLabel = data.label;
      this.mySubnetId = data.subnetId;
      this.state = data.state;
      this.roomCode = data.state.code;
      this._emitCallback('onRoomJoined', data);
    });

    this.socket.on('state-update', (newState) => {
      this.state = newState;
      this._emitCallback('onStateUpdate', newState);
    });

    for (const [event, callbackName] of Object.entries(NetworkClient.EVENT_CALLBACKS)) {
      if (event === 'room-joined' || event === 'state-update') continue;
      this.socket.on(event, (data) => {
        if (event === 'dns-response' || event === 'dns-query' || event === 'firewall-decision') {
          console.log(`[NetworkClient] ${event} recibido:`, data);
        }
        this._emitCallback(callbackName, data);
      });
    }

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
