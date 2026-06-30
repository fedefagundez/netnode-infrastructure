class SendMessage {
  constructor(networkClient) {
    this.client = networkClient;
  }

  execute(toNodeId, text) {
    if (!text || !text.trim()) {
      return { success: false, message: 'El mensaje está vacío.' };
    }

    this.client.sendMessage(toNodeId, text.trim());
    return { success: true };
  }
}

export { SendMessage };
