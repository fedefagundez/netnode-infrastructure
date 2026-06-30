class ReceiveMessage {
  constructor() {
    this.messages = [];
    this.onNewMessage = null;
  }

  addMessage(data) {
    this.messages.push(data);
    if (this.onNewMessage) this.onNewMessage(data);
  }

  getMessages() {
    return this.messages;
  }

  getMessagesWith(nodeId) {
    return this.messages.filter(
      m => (m.from === nodeId) || (m.toNodeId === nodeId)
    );
  }
}

export { ReceiveMessage };
