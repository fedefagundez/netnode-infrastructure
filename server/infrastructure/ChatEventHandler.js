export class ChatEventHandler {
  constructor(roomManager, io) {
    this.roomManager = roomManager;
    this.io = io;
  }

  handleSetFirewallRules(socket, data) {
    const room = this.roomManager.getRoomByTeacherSocket(socket.id);
    if (!room) return;

    const { firewallId, rules } = data;
    room.setFirewallRules(firewallId, rules);
    this.io.to(room.code).emit('state-update', room.getState());
    console.log(`[Server] Firewall rules actualizadas en sala ${room.code}: Firewall ${firewallId}`);
  }

  handleGetFirewallRules(socket, data) {
    const room = this.roomManager.getRoomByTeacherSocket(socket.id);
    if (!room) return;

    const { firewallId } = data;
    const rules = room.getFirewallRules(firewallId);
    socket.emit('firewall-rules', { firewallId, rules });
  }

  handleGetChatLog(socket, data) {
    const room = this.roomManager.getRoomByTeacherSocket(socket.id);
    if (!room) return;

    const { nodeA, nodeB } = data;
    const log = room.getChatLog(nodeA, nodeB);
    socket.emit('chat-log', { nodeA, nodeB, messages: log });
  }

  handleGetChatPairs(socket) {
    const room = this.roomManager.getRoomByTeacherSocket(socket.id);
    if (!room) return;

    const pairs = room.getChatPairs();
    socket.emit('chat-pairs', pairs);
  }
}
