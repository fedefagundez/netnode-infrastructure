import { calculatePositions } from '../domain/layout.js';
import { Camera } from '../domain/Camera.js';
import { CanvasInteraction } from '../infrastructure/CanvasInteraction.js';
import { findSpecialNodes } from '../domain/findSpecialNodes.js';
import { getThemeColors } from '../domain/ThemeColors.js';
import { PacketAnimator } from './PacketAnimator.js';
import { drawTopology as drawTopologyShared } from './drawTopologyShared.js';
import { NodeLogStore } from './NodeLogStore.js';
import { NodeLogPopover } from './NodeLogPopover.js';

class TeacherDashboard {
  constructor(socket, canvasAdapter, networkClient) {
    this.socket = socket;
    this.canvas = canvasAdapter;
    this.networkClient = networkClient;
    this.roomCode = null;
    this.groupName = null;
    this.state = { nodes: [], edges: [], topology: 'school-network' };
    this.chatPairs = [];
    this.selectedChat = null;
    this.chatLog = [];
    this.onChatLogUpdate = null;
    this.selectedFirewall = null;
    this.camera = new Camera(window.devicePixelRatio || 1);
    this.nodeLog = new NodeLogStore();
    this.popover = new NodeLogPopover();

    this.animator = new PacketAnimator({
      getPosition: (id) => this._getPosition(id),
      getNode: (id) => this.state.nodes.find(n => n.id === id) || null,
      onDraw: () => this.drawTopology(),
    });

    window.addEventListener('themechange', () => this.drawTopology());

    this.shareLinkEl = document.getElementById('teacher-share-link');
    this.roomCodeEl = document.getElementById('teacher-room-code');
    this.btnCopyLink = document.getElementById('btn-copy-link');
    this.btnCopyCode = document.getElementById('btn-copy-code');
    this.groupNameEl = document.getElementById('teacher-group-name');
    this.nodeCountEl = document.getElementById('teacher-node-count');
    this.chatPairsEl = document.getElementById('chat-pairs');
    this.chatLogEl = document.getElementById('teacher-chat-log');
    this.chatTitleEl = document.getElementById('monitor-chat-title');
    this.chatSearchEl = document.getElementById('chat-search-input');
    this.monitorListView = document.getElementById('monitor-list-view');
    this.monitorChatView = document.getElementById('monitor-chat-view');
    this.btnMonitorBack = document.getElementById('btn-monitor-back');

    this.btnCopyLink.addEventListener('click', () => this.copyToClipboard(this.shareLinkEl));
    this.btnCopyCode.addEventListener('click', () => this.copyToClipboard(this.roomCodeEl, true));
    this.chatSearchEl.addEventListener('input', () => this.filterChatPairs());
    this.btnMonitorBack.addEventListener('click', () => this.showListView());
    this.setupSocketListeners();
    new CanvasInteraction(this.canvas, this.camera, () => this.drawTopology());
    this.canvas.canvas.addEventListener('click', (e) => this._onCanvasClick(e));
  }

  _getPosition(nodeId) {
    const positions = calculatePositions(this.state.nodes, this.camera.width, this.camera.height, this.state.topology);
    return positions.find(p => p.node.id === nodeId) || null;
  }

  _setupSpecialNodes() {
    const { routerCentral, dns } = findSpecialNodes(this.state.nodes);
    if (routerCentral && dns) {
      this.animator.setSpecialNodes(routerCentral.id, dns.id);
    }
  }

  copyToClipboard(element, isCode = false) {
    const text = element.textContent || element.value;
    navigator.clipboard.writeText(text);
    const btn = isCode ? this.btnCopyCode : this.btnCopyLink;
    const original = btn.textContent;
    btn.textContent = 'Copiado!';
    setTimeout(() => { btn.textContent = original; }, 2000);
  }

  setupSocketListeners() {
    this.socket.on('room-created', (data) => {
      this.roomCode = data.code;
      this.groupName = data.groupName;
      const baseUrl = window.location.origin + window.location.pathname;
      this.shareLinkEl.value = baseUrl + '?join=1';
      this.groupNameEl.textContent = data.groupName;
    });

    this.socket.on('state-update', (newState) => {
      this.state = newState;
      this.nodeCountEl.textContent = newState.nodes.filter(n => n.type === 'client').length + ' alumnos conectados';
      this._setupSpecialNodes();
      this.updateChatPairs();
      this.drawTopology();
    });

    this.socket.on('student-joined', (data) => {
      this.addSystemMessage(`${data.name} (Nodo ${data.label}) se unio a la sala - Sub-red ${data.subnetId + 1}`);
    });

    this.socket.on('student-left', (data) => {
      this.addSystemMessage(`${data.name} (Nodo ${data.label}) salio de la sala`);
    });

    this.socket.on('room-message', (data) => {
      if (this.selectedChat) {
        const { fromLabel, toLabel } = this.selectedChat;
        if ((data.fromLabel === fromLabel && data.toLabel === toLabel) ||
            (data.fromLabel === toLabel && data.toLabel === fromLabel)) {
          this.appendChatMessage(data.from, data.text, data.timestamp);
        }
      }
      this.addMessageIndicator(data.fromLabel, data.toLabel);
    });

    this.socket.on('chat-log', (data) => {
      this.chatLog = data.messages;
      this.renderChatLog();
    });

    this.socket.on('chat-pairs', (pairs) => {
      this.chatPairs = pairs;
      this.renderChatPairs();
    });

    this.socket.on('room-closed', (data) => {
      alert(data.reason);
      window.location.reload();
    });

    this.socket.on('packet', (data) => {
      if (data.path && data.path.length > 1) {
        this.animator.animate(data.path);
      }
      if (data.nodeLogs) {
        console.log('[Teacher] nodeLogs recibidos:', data.nodeLogs.length);
        for (const entry of data.nodeLogs) {
          this.nodeLog.add(entry.nodeId, entry.text, entry.type, entry.timestamp);
        }
      }
    });
  }

  updateChatPairs() {
    this.socket.emit('get-chat-pairs');
  }

  renderChatPairs() {
    const query = this.chatSearchEl ? this.chatSearchEl.value.toLowerCase().trim() : '';
    this.chatPairsEl.innerHTML = '';

    const filtered = query
      ? this.chatPairs.filter(p =>
          p.a.name.toLowerCase().includes(query) ||
          p.b.name.toLowerCase().includes(query) ||
          p.a.label.toLowerCase().includes(query) ||
          p.b.label.toLowerCase().includes(query)
        )
      : this.chatPairs;

    filtered.forEach(pair => {
      const div = document.createElement('div');
      div.className = 'chat-pair-item';
      const isSelected = this.selectedChat &&
        this.selectedChat.a.id === pair.a.id &&
        this.selectedChat.b.id === pair.b.id;
      if (isSelected) div.classList.add('active');

      const subnetA = pair.a.subnetId !== undefined ? pair.a.subnetId : '?';
      const subnetB = pair.b.subnetId !== undefined ? pair.b.subnetId : '?';

      div.innerHTML = `
        <div class="pair-info">
          <span class="pair-names">${pair.a.name} <-> ${pair.b.name}</span>
          <span class="pair-labels">Nodo ${pair.a.label} (Red ${subnetA + 1}) - Nodo ${pair.b.label} (Red ${subnetB + 1})</span>
        </div>
        <button class="btn-monitor" data-pair='${JSON.stringify(pair)}'>Ver</button>
      `;

      div.querySelector('.btn-monitor').addEventListener('click', () => {
        this.selectChat(pair);
      });

      this.chatPairsEl.appendChild(div);
    });
  }

  filterChatPairs() {
    this.renderChatPairs();
  }

  showListView() {
    this.monitorListView.classList.remove('hidden');
    this.monitorChatView.classList.add('hidden');
    this.selectedChat = null;
    this.renderChatPairs();
  }

  showChatView() {
    this.monitorListView.classList.add('hidden');
    this.monitorChatView.classList.remove('hidden');
  }

  selectChat(pair) {
    this.selectedChat = pair;
    this.chatTitleEl.textContent = `${pair.a.name} <-> ${pair.b.name}`;
    this.showChatView();
    this.chatLogEl.innerHTML = '';
    this.socket.emit('get-chat-log', { nodeA: pair.a.id, nodeB: pair.b.id });
  }

  renderChatLog() {
    this.chatLogEl.innerHTML = '';
    this.chatLog.forEach(msg => {
      const senderNode = this.state.nodes.find(n => n.id === msg.fromId);
      const senderName = senderNode ? senderNode.name : 'Nodo ' + msg.fromId;
      this.appendChatMessage(senderName, msg.text, msg.timestamp);
    });
  }

  appendChatMessage(sender, text, timestamp) {
    const div = document.createElement('div');
    div.className = 'monitor-message';
    const time = new Date(timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<span class="msg-time">[${time}]</span> <strong>${sender}:</strong> ${text}`;
    this.chatLogEl.appendChild(div);
    this.chatLogEl.scrollTop = this.chatLogEl.scrollHeight;
  }

  addSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'monitor-system';
    div.textContent = text;
    this.chatLogEl.appendChild(div);
    this.chatLogEl.scrollTop = this.chatLogEl.scrollHeight;
  }

  addMessageIndicator(fromLabel, toLabel) {
    const items = this.chatPairsEl.querySelectorAll('.chat-pair-item');
    items.forEach(item => {
      const btn = item.querySelector('.btn-monitor');
      if (btn) {
        const pair = JSON.parse(btn.dataset.pair);
        if ((pair.a.label === fromLabel && pair.b.label === toLabel) ||
            (pair.a.label === toLabel && pair.b.label === fromLabel)) {
          btn.classList.add('has-message');
          setTimeout(() => btn.classList.remove('has-message'), 2000);
        }
      }
    });
  }

  drawTopology() {
    if (!this.canvas) return;

    const outer = this.canvas.outer;
    const rect = outer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height;

    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    this.camera.setSize(bw / dpr, bh / dpr, dpr);
    this.canvas.setSize(bw, bh);
    this.canvas.setStyleSize(bw / dpr, bh / dpr);
    this.canvas.setTransform(dpr);

    const ctx = this.canvas.ctx;
    const cam = this.camera;
    const theme = getThemeColors();

    if (this.state.nodes.length === 0) {
      ctx.fillStyle = theme.textPrimary;
      ctx.font = '14px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Esperando nodos...', w / 2, h / 2);
      return;
    }

    drawTopologyShared(ctx, cam, this.state.nodes, this.state.edges, {
      animator: this.animator,
      theme: theme,
      topology: this.state.topology,
    });
  }

  _onCanvasClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const positions = calculatePositions(this.state.nodes, this.camera.width, this.camera.height, this.state.topology);
    const nr = Math.max(14, Math.round(this.camera.width * 0.025));

    for (const pos of positions) {
      const sp = this.camera.worldToScr(pos.x, pos.y);
      if (Math.hypot(sp.x - sx, sp.y - sy) <= nr * this.camera.scale + 6) {
        if (pos.node.type && pos.node.type !== 'client') {
          const entries = this.nodeLog.get(pos.node.id);
          this.popover.show(pos.node.name, pos.node.type, entries, e.clientX, e.clientY);
        }
        return;
      }
    }
  }
}

export { TeacherDashboard };
