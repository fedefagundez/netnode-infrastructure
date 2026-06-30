import { Room } from './Room.js';

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  generateCode() {
    let code;
    do {
      code = Math.floor(1000 + Math.random() * 9000).toString();
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(groupName, teacherSocketId) {
    const code = this.generateCode();
    const room = new Room(code, groupName, teacherSocketId);
    this.rooms.set(code, room);
    console.log(`[RoomManager] Sala creada: ${code} (${groupName})`);
    return room;
  }

  getRoom(code) {
    return this.rooms.get(code) || null;
  }

  removeRoom(code) {
    const room = this.rooms.get(code);
    if (room) {
      this.rooms.delete(code);
      console.log(`[RoomManager] Sala eliminada: ${code}`);
    }
    return room;
  }

  getRoomByTeacherSocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.teacherSocketId === socketId) return room;
    }
    return null;
  }

  getRoomByStudentSocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.getNodeBySocket(socketId)) return room;
    }
    return null;
  }

  removeStudentFromAllRooms(socketId) {
    for (const room of this.rooms.values()) {
      const node = room.removeNode(socketId);
      if (node) return { room, node };
    }
    return null;
  }

  getActiveRooms() {
    return Array.from(this.rooms.values()).map(r => ({
      code: r.code,
      groupName: r.groupName,
      nodeCount: r.nodeCount(),
      createdAt: r.createdAt,
    }));
  }
}

export { RoomManager };
