class SentMessage {
  constructor() {
    this.messages = [];
  }

  addMessage(data) {
    this.messages.push(data);
  }

  getMessages() {
    return this.messages;
  }

  getMessagesWith(nodeId) {
    return this.messages.filter(m => m.toNodeId === nodeId);
  }
}

export { SentMessage };
