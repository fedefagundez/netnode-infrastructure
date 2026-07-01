import { Camera } from './domain/Camera.js';
import { Network } from './domain/Network.js';
import { NetworkClient } from './infrastructure/NetworkClient.js';
import { MobileTabs } from './infrastructure/MobileTabs.js';
import { CanvasInteraction } from './infrastructure/CanvasInteraction.js';
import { SendMessage } from './application/SendMessage.js';
import { ToggleNode } from './application/ToggleNode.js';
import { ReceiveMessage } from './application/ReceiveMessage.js';
import { SentMessage } from './application/SentMessage.js';
import { CanvasAdapter } from './infrastructure/CanvasAdapter.js';
import { CanvasRenderer } from './presentation/CanvasRenderer.js';
import { ChatPanel } from './presentation/ChatPanel.js';
import { TeacherDashboard } from './presentation/TeacherDashboard.js';

class App {
  constructor() {
    this.client = new NetworkClient();

    this.screens = {
      login: document.getElementById('role-screen'),
      teacherDashboard: document.getElementById('teacher-dashboard-screen'),
      studentJoin: document.getElementById('student-join-screen'),
      studentApp: document.getElementById('student-app-screen'),
    };

    this.camera = null;
    this.network = null;
    this.receiveMessage = null;
    this.sentMessage = null;
    this.sendMessage = null;
    this.canvasAdapter = null;
    this.renderer = null;
    this.chatPanel = null;
    this.teacherDashboard = null;
    this.pendingMessage = null;

    this.client.connect();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('join')) {
      this.showScreen('studentJoin');
      this.setupStudentJoin();
    } else {
      this.showScreen('login');
      this.setupLogin();
    }
  }

  showScreen(screenName) {
    Object.values(this.screens).forEach(s => s.classList.add('hidden'));
    if (this.screens[screenName]) {
      this.screens[screenName].classList.remove('hidden');
    }
  }

  setupLogin() {
    const teacherNameInput = document.getElementById('teacher-name-input');
    const groupNameInput = document.getElementById('group-name-input');
    const btnCreate = document.getElementById('btn-create-room');

    teacherNameInput.focus();

    btnCreate.addEventListener('click', () => this.createRoom());
    groupNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.createRoom();
    });
    teacherNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') groupNameInput.focus();
    });
  }

  createRoom() {
    const teacherName = document.getElementById('teacher-name-input').value.trim();
    const groupName = document.getElementById('group-name-input').value.trim();
    if (!teacherName || !groupName) return;

    this.client.createRoom(groupName, teacherName);

    this.client.onRoomCreated = (data) => {
      this.showScreen('teacherDashboard');
      this.initTeacherDashboard(data, teacherName);
    };

    this.client.onError = (data) => {
      alert(data.message);
    };
  }

  initTeacherDashboard(data, teacherName) {
    const teacherCanvas = new CanvasAdapter('teacher-canvas', 'teacher-canvas-outer');
    this.teacherDashboard = new TeacherDashboard(this.client.socket, teacherCanvas, this.client);
    this.teacherDashboard.roomCode = data.code;
    this.teacherDashboard.groupName = data.groupName;

    const baseUrl = window.location.origin + window.location.pathname;
    document.getElementById('teacher-share-link').value = baseUrl + '?join=1';
    document.getElementById('teacher-room-code').textContent = data.code;
    document.getElementById('teacher-group-name').textContent = data.groupName;
    document.getElementById('teacher-node-count').textContent = '0 nodos conectados';

    this.teacherDashboard.updateChatPairs();

    new ResizeObserver(() => this.teacherDashboard.drawTopology())
      .observe(document.getElementById('teacher-canvas-outer'));

    requestAnimationFrame(() => {
      this.teacherDashboard.drawTopology();
    });
  }

  setupStudentJoin() {
    const roomCodeInput = document.getElementById('room-code-input');
    const studentNameInput = document.getElementById('student-name-input');
    const btnJoin = document.getElementById('btn-join-room');

    roomCodeInput.focus();

    btnJoin.addEventListener('click', () => this.joinRoom());
    roomCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') studentNameInput.focus();
    });
    studentNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.joinRoom();
    });
  }

  joinRoom() {
    const code = document.getElementById('room-code-input').value.trim();
    const name = document.getElementById('student-name-input').value.trim();
    if (!code || !name) return;

    this.client.onError = (data) => {
      alert(data.message);
    };

    this.client.onRoomJoined = (data) => {
      this.showScreen('studentApp');
      this.initStudentApp(data, name);
    };

    this.client.joinRoom(code, name);
  }

  initStudentApp(data, name) {
    this.camera = new Camera(window.devicePixelRatio || 1);
    this.network = new Network(this.camera);
    this.receiveMessage = new ReceiveMessage();
    this.sentMessage = new SentMessage();
    this.sendMessage = new SendMessage(this.client);
    this.toggleNode = new ToggleNode(this.client);

    document.getElementById('my-name').textContent = name;
    document.getElementById('my-label').textContent = data.label;

    this.network.myNodeId = data.nodeId;
    this.network.updateState(data.state);
    this.updateBadge();
    this.initCanvas();
    this.renderer.setupSpecialNodes();
    this.initChat();
    this.mobileTabs = new MobileTabs();

    document.getElementById('status').textContent =
      `Conectado como Nodo ${data.label} — ${data.state.nodes.length} nodos en la red`;

    this.client.onStateUpdate = (newState) => {
      this.network.updateState(newState);
      this.updateBadge();
      if (this.renderer) {
        this.network.assignPositions();
        this.renderer.draw();
      }
      if (this.chatPanel) {
        this.chatPanel.updateContacts(newState.nodes, this.client.getMyNodeId());
        this.chatPanel.storeContext(newState.nodes, this.client.getMyNodeId());
      }
      document.getElementById('status').textContent = `${newState.nodes.length} nodos en la red`;
    };

    this.client.onPacket = (data) => {
      if (this.renderer && data.path && data.path.length > 1) {
        this.renderer.onAnimationComplete = () => {
          if (this.pendingMessage) {
            this.receiveMessage.addMessage(this.pendingMessage);
            if (this.chatPanel) {
              this.chatPanel.onNewIncomingMessage(this.pendingMessage);
            }
            this.pendingMessage = null;
          }
        };
        this.renderer.animatePacket(data.path);
      }
      if (data.nodeLogs && this.renderer) {
        console.log('[App] nodeLogs recibidos:', data.nodeLogs.length);
        for (const entry of data.nodeLogs) {
          this.renderer.nodeLog.add(entry.nodeId, entry.text, entry.type, entry.timestamp);
        }
      }
    };

    this.client.onReceiveMessage = (data) => {
      this.pendingMessage = data;
    };

    this.client.onMessageError = (data) => {
      if (this.chatPanel) {
        this.chatPanel.onMessageError(data);
      }
    };

    this.client.onDnsResponse = (data) => {
      console.log('[App] onDnsResponse:', data);
      if (this.chatPanel) {
        this.chatPanel.onDnsResponse(data);
      }
    };

    this.client.onDnsQuery = (data) => {
      console.log('[App] onDnsQuery:', data);
      if (data.nodeLogs && this.renderer) {
        console.log('[App] dns nodeLogs recibidos:', data.nodeLogs.length);
        for (const entry of data.nodeLogs) {
          this.renderer.nodeLog.add(entry.nodeId, entry.text, entry.type, entry.timestamp);
        }
      }
      if (this.renderer && this.renderer.animator && data.path) {
        this.renderer.animator.animateDnsQuery(data.path, null);
        this.renderer.animator.onClientDnsComplete = () => {
          console.log('[App] onClientDnsComplete called');
          if (this.chatPanel) {
            this.chatPanel.sendPendingDnsMessage();
          }
        };
      }
    };

    this.client.onFirewallDecision = (data) => {
      console.log('[App] onFirewallDecision:', data);
      if (data.decision === 'reject' && this.renderer) {
        this.renderer.nodeLog.add(data.firewallId, `Firewall: Denegada ${data.fromName} → ${data.toName}`, 'firewall', Date.now());
      }
      if (this.renderer && data.firewallId && data.decision) {
        this.renderer.nodeAnimations.trigger(data.firewallId, data.decision);
      }
    };

    this.client.onRoomClosed = (data) => {
      alert(data.reason);
      window.location.reload();
    };
  }

  initCanvas() {
    this.canvasAdapter = new CanvasAdapter('c', 'canvas-outer');
    this.renderer = new CanvasRenderer(this.canvasAdapter, this.camera, this.network);

    new ResizeObserver(() => this.onResize()).observe(this.canvasAdapter.outer);
    this.onResize();

    new CanvasInteraction(this.canvasAdapter, this.camera, () => this.renderer.draw());
  }

  onResize() {
    if (!this.canvasAdapter) return;

    const outer = this.canvasAdapter.outer;
    const rect = outer.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const bw = Math.round(rect.width * dpr);
    const bh = Math.round(rect.height * dpr);
    this.camera.setSize(bw / dpr, bh / dpr, dpr);
    this.canvasAdapter.setSize(bw, bh);
    this.canvasAdapter.setStyleSize(bw / dpr, bh / dpr);
    this.canvasAdapter.setTransform(dpr);

    this.network.assignPositions();
    this.renderer.draw();
  }

  initChat() {
    this.chatPanel = new ChatPanel(this.receiveMessage, this.sentMessage, this.sendMessage, this.toggleNode, this.client, this.renderer);
    this.chatPanel.updateContacts(this.network.nodes, this.client.getMyNodeId());
    this.chatPanel.storeContext(this.network.nodes, this.client.getMyNodeId());
  }

  updateBadge() {
    const count = this.network.nodeCount();
    document.getElementById('badge').textContent = count + ' nodo' + (count !== 1 ? 's' : '');
  }
}

export { App };
