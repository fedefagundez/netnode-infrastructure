class MessageLog {
  constructor() {
    this.messages = [];
  }

  log(fromId, toId, text) {
    this.messages.push({
      fromId,
      toId,
      text,
      timestamp: Date.now(),
    });
  }

  getChatLog(nodeA, nodeB) {
    return this.messages.filter(
      m => (m.fromId === nodeA && m.toId === nodeB) ||
           (m.fromId === nodeB && m.toId === nodeA)
    );
  }

  getAllChats() {
    const chats = new Map();
    for (const msg of this.messages) {
      const key = [msg.fromId, msg.toId].sort().join('-');
      if (!chats.has(key)) {
        chats.set(key, []);
      }
      chats.get(key).push(msg);
    }
    return chats;
  }
}

export { MessageLog };
