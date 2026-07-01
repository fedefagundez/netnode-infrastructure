class ChatPanel {
  constructor(receiveMessage, sentMessage, sendMessage, toggleNode, networkClient, renderer) {
    this.receiveMessage = receiveMessage;
    this.sentMessage = sentMessage;
    this.sendMessage = sendMessage;
    this.toggleNode = toggleNode;
    this.networkClient = networkClient;
    this.renderer = renderer;
    this.selectedContact = null;
    this.myNodeOn = true;
    this.pendingByContact = {};
    this.pendingDnsQuery = null;

    this.contactsView = document.getElementById('contacts-view');
    this.chatView = document.getElementById('chat-view');
    this.contactsList = document.getElementById('contacts-list');
    this.chatWith = document.getElementById('chat-with');
    this.chatMessages = document.getElementById('chat-messages');
    this.msgInput = document.getElementById('msg-input');
    this.btnSend = document.getElementById('btn-send');
    this.btnToggle = document.getElementById('btn-toggle-node');
    this.btnBack = document.getElementById('btn-back');
    this.statusText = document.getElementById('my-status');

    this.btnSend.addEventListener('click', () => this.handleSend());
    this.msgInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleSend();
    });

    this.btnToggle.addEventListener('click', () => this.handleToggle());
    this.btnBack.addEventListener('click', () => this.showContactsView());
    this.updateToggleUI();
    this.updateSendButton();
  }

  showContactsView() {
    this.contactsView.classList.remove('hidden');
    this.chatView.classList.add('hidden');
    this.selectedContact = null;
    this.updateContacts(this.lastNodes || [], this.lastMyNodeId);
  }

  showChatView() {
    this.contactsView.classList.add('hidden');
    this.chatView.classList.remove('hidden');
  }

  handleToggle() {
    this.myNodeOn = !this.myNodeOn;
    this.toggleNode.execute();
    this.updateToggleUI();
    this.updateSendButton();
    if (typeof Sounds !== 'undefined') Sounds.toggle();
  }

  updateToggleUI() {
    if (this.myNodeOn) {
      this.btnToggle.textContent = 'On';
      this.btnToggle.className = 'toggle-btn on';
      this.statusText.textContent = 'Nodo activo';
    } else {
      this.btnToggle.textContent = 'Off';
      this.btnToggle.className = 'toggle-btn off';
      this.statusText.textContent = 'Nodo apagado';
    }
  }

  updateSendButton() {
    if (!this.myNodeOn) {
      this.msgInput.disabled = true;
      this.btnSend.disabled = true;
      this.msgInput.placeholder = 'Nodo apagado - no podes enviar mensajes';
    } else if (this.selectedContact) {
      this.msgInput.disabled = false;
      this.btnSend.disabled = false;
      this.msgInput.placeholder = 'Escribi un mensaje...';
    }
  }

  updateMyNodeState(isOn) {
    this.myNodeOn = isOn;
    this.updateToggleUI();
    this.updateSendButton();
  }

  markPending(fromNodeId) {
    if (!this.pendingByContact[fromNodeId]) {
      this.pendingByContact[fromNodeId] = 0;
    }
    this.pendingByContact[fromNodeId]++;
    this.updateContacts(this.lastNodes || [], this.lastMyNodeId);

    const items = this.contactsList.querySelectorAll('.contact-item');
    items.forEach(item => {
      const label = item.querySelector('.contact-label');
      if (label && label.textContent.includes('Nodo')) {
        const nodeLabel = label.textContent.replace('Nodo ', '').trim();
        const node = (this.lastNodes || []).find(n => n.label === nodeLabel && n.id === fromNodeId);
        if (node) {
          item.classList.add('highlight');
          setTimeout(() => item.classList.remove('highlight'), 1500);
        }
      }
    });
  }

  clearPending(nodeId) {
    this.pendingByContact[nodeId] = 0;
    this.updateContacts(this.lastNodes || [], this.lastMyNodeId);
  }

  updateContacts(nodes, myNodeId) {
    this.contactsList.innerHTML = '';
    nodes
      .filter(n => n.id !== myNodeId && (!n.type || n.type === 'client'))
      .forEach(n => {
        const div = document.createElement('div');
        div.className = 'contact-item' + (this.selectedContact && this.selectedContact.id === n.id ? ' active' : '');
        const dotColor = n.on ? '#26890c' : '#8b6fb0';
        const pending = this.pendingByContact[n.id] || 0;
        const pendingBadge = pending > 0
          ? `<span class="pending-count">${pending}</span>`
          : '';
        div.innerHTML = `
          <div class="contact-dot" style="background: ${dotColor}"></div>
          <div class="contact-info">
            <div class="contact-name">${n.name} ${!n.on ? '(apagado)' : ''}</div>
            <div class="contact-label">Nodo ${n.label}</div>
          </div>
          ${pendingBadge}
        `;
        div.addEventListener('click', () => this.selectContact(n));
        this.contactsList.appendChild(div);
      });
  }

  selectContact(node) {
    this.selectedContact = node;
    this.chatWith.textContent = `Chat con ${node.name} (${node.label})`;
    this.chatMessages.innerHTML = '';
    this.clearPending(node.id);
    this.updateSendButton();
    this.showChatView();

    const received = this.receiveMessage.getMessages().filter(
      m => m.from === node.id
    );
    const sent = this.sentMessage.getMessages().filter(
      m => m.toNodeId === node.id
    );

    const all = [
      ...received.map(m => ({ ...m, dir: 'in', displayName: m.fromName })),
      ...sent.map(m => ({ ...m, dir: 'out', displayName: 'Yo' })),
    ].sort((a, b) => a.timestamp - b.timestamp);

    all.forEach(m => {
      this.appendMessage(m.displayName, m.text, m.dir);
    });
  }

  onNewIncomingMessage(data) {
    if (typeof Sounds !== 'undefined') Sounds.receive();
    if (this.selectedContact && data.from === this.selectedContact.id) {
      this.appendMessage(data.fromName, data.text, 'in');
    } else {
      this.markPending(data.from);
    }
  }

  onDnsResponse(data) {
    console.log('[ChatPanel] onDnsResponse:', data);
    const dnsNotification = document.createElement('div');
    dnsNotification.className = 'dns-notification';
    if (data.found) {
      dnsNotification.innerHTML = `<strong>DNS:</strong> "${data.query}" resuelto a Nodo ${data.label} (${data.nodeName})`;
      dnsNotification.style.borderColor = '#26890c';
    } else {
      dnsNotification.innerHTML = `<strong>DNS:</strong> "${data.query}" no encontrado`;
      dnsNotification.style.borderColor = '#e21b3c';
    }
    document.body.appendChild(dnsNotification);

    setTimeout(() => {
      dnsNotification.classList.add('fade-out');
      setTimeout(() => dnsNotification.remove(), 500);
    }, 2000);
  }

  onMessageError(data) {
    if (typeof Sounds !== 'undefined') Sounds.error();
    let text = '';
    if (data.reason === 'receptor-apagado') {
      text = `No se pudo entregar: ${data.receiverName} esta apagado`;
    } else if (data.reason === 'sin-ruta') {
      text = `No se pudo entregar: no hay ruta hacia ${data.receiverName}`;
    } else if (data.reason === 'receptor-no-existe') {
      text = 'No se pudo entregar: receptor no encontrado';
    } else if (data.reason === 'firewall-bloqueado') {
      text = `Bloqueado por ${data.firewallName}: no puedes enviar mensajes a ${data.receiverName}`;
    } else {
      text = 'No se pudo entregar el mensaje';
    }
    this.appendErrorMessage(text);
  }

  appendMessage(sender, text, direction) {
    const div = document.createElement('div');
    div.className = 'message ' + direction;
    if (direction === 'in') {
      div.innerHTML = `<div class="sender">${sender}</div>${text}`;
    } else {
      div.textContent = text;
    }
    this.chatMessages.appendChild(div);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  appendErrorMessage(text) {
    const div = document.createElement('div');
    div.className = 'message error';
    div.textContent = text;
    this.chatMessages.appendChild(div);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  handleSend() {
    if (!this.selectedContact) return;
    if (!this.myNodeOn) return;
    const text = this.msgInput.value.trim();
    if (!text) return;

    if (typeof Sounds !== 'undefined') Sounds.send();

    if (this.networkClient) {
      this.pendingDnsQuery = { nodeId: this.selectedContact.id, text: text };
      console.log('[ChatPanel] handleSend: pendingDnsQuery set, sending dnsQuery for:', this.selectedContact.name);
      this.networkClient.dnsQuery(this.selectedContact.name);
    } else {
      console.log('[ChatPanel] No hay networkClient, enviando directo');
      this._doSendMessage(this.selectedContact.id, text);
    }
  }

  _doSendMessage(toNodeId, text) {
    console.log('[ChatPanel] _doSendMessage called');
    const result = this.sendMessage.execute(toNodeId, text);
    if (result.success) {
      this.sentMessage.addMessage({
        from: this.lastMyNodeId,
        toNodeId: toNodeId,
        text: text,
        timestamp: Date.now(),
      });
      this.appendMessage('Yo', text, 'out');
      this.msgInput.value = '';
    }
  }

  sendPendingDnsMessage() {
    console.log('[ChatPanel] sendPendingDnsMessage called, pending:', this.pendingDnsQuery);
    if (this.pendingDnsQuery) {
      const { nodeId, text } = this.pendingDnsQuery;
      this.pendingDnsQuery = null;
      this._doSendMessage(nodeId, text);
    }
  }

  storeContext(nodes, myNodeId) {
    this.lastNodes = nodes;
    this.lastMyNodeId = myNodeId;
  }
}

export { ChatPanel };
