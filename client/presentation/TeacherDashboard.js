import { calculatePositions } from '../domain/layout.js';
import { Camera } from '../domain/Camera.js';
import { CanvasInteraction } from '../infrastructure/CanvasInteraction.js';
import { findSpecialNodes } from '../domain/findSpecialNodes.js';
import { getThemeColors, isDark } from '../domain/ThemeColors.js';
import { drawNodeByType, drawPacket, drawDnsPacket } from './NodeRenderer.js';
import { PacketAnimator } from './PacketAnimator.js';
import { NODE_TYPE_INFO } from '../domain/NodeTypes.js';

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

    this.animator = new PacketAnimator({
      getPosition: (id) => this._getPosition(id),
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

    this.camera.setSize(w, h, dpr);
    this.canvas.setSize(Math.round(w * dpr), Math.round(h * dpr));
    this.canvas.setStyleSize(w, h);
    this.canvas.setTransform(dpr);

    const ctx = this.canvas.ctx;
    const cam = this.camera;

    const dark = isDark();
    ctx.fillStyle = dark ? '#1e0a3c' : '#e8deff';
    ctx.fillRect(0, 0, w, h);

    const gridColor = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
    const step = Math.round(w / 17 / cam.scale);
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1 / cam.scale;
    for (let x = 0; x <= w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y <= h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const nodes = this.state.nodes;
    const edges = this.state.edges;
    const theme = getThemeColors();

    if (nodes.length === 0) {
      ctx.fillStyle = theme.textPrimary;
      ctx.font = '14px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Esperando nodos...', w / 2, h / 2);
      return;
    }

    ctx.save();
    ctx.translate(cam.offsetX, cam.offsetY);
    ctx.scale(cam.scale, cam.scale);

    const positions = calculatePositions(nodes, cam.width, cam.height, this.state.topology);
    const posMap = new Map(positions.map(p => [p.node.id, p]));

    ctx.lineCap = 'round';
    for (const edge of edges) {
      const a = posMap.get(edge.from);
      const b = posMap.get(edge.to);
      if (!a || !b) continue;

      const na = nodes.find(n => n.id === edge.from);
      const nb = nodes.find(n => n.id === edge.to);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);

      if (!na.on || !nb.on) {
        ctx.strokeStyle = theme.edgeDead;
        ctx.setLineDash([4 / cam.scale, 4 / cam.scale]);
      } else {
        ctx.strokeStyle = theme.edge;
        ctx.setLineDash([]);
      }
      ctx.lineWidth = 1.5 / cam.scale;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const nr = Math.max(14, Math.round(cam.width * 0.022));
    const colors = {
      nodeActive: theme.nodeActive,
      nodeActiveBr: theme.nodeActiveBr,
      nodeOff: theme.nodeOff,
      nodeOffBr: theme.nodeOffBr,
      nodeMe: theme.nodeActive,
      nodeMeBr: theme.nodeActiveBr,
      lblOn: theme.lblOn,
      lblOff: theme.lblOff,
      theme: theme,
    };
    for (const pos of positions) {
      drawNodeByType(ctx, pos.node, pos.x, pos.y, nr, colors, cam.scale);
    }

    const pr = Math.max(7, Math.round(cam.width * 0.012));
    for (const pkt of this.animator.packets) {
      if (pkt.pos) {
        drawPacket(ctx, pkt.pos.x, pkt.pos.y, pr, cam.scale, theme);
      }
    }

    const dnsPr = Math.max(5, Math.round(cam.width * 0.008));
    for (const q of this.animator.dnsQueries) {
      if (q.pos) {
        drawDnsPacket(ctx, q.pos.x, q.pos.y, dnsPr, cam.scale, theme);
      }
    }

    ctx.restore();
  }
}

export { TeacherDashboard };
