export class RoomEventHandler {
  constructor(roomManager, io) {
    this.roomManager = roomManager;
    this.io = io;
  }

  handleCreateRoom(socket, data) {
    const { groupName, teacherName } = data;
    if (!groupName || !groupName.trim()) {
      socket.emit('error', { message: 'Nombre de grupo invalido' });
      return;
    }

    const room = this.roomManager.createRoom(groupName.trim(), socket.id);
    room.teacherName = teacherName || 'Profesor';
    room.topology = 'school-network';
    room.createSubnets();

    socket.join(room.code);

    socket.emit('room-created', {
      code: room.code,
      groupName: room.groupName,
      teacherName: room.teacherName,
      topology: room.topology,
    });

    console.log(`[Server] Profesor creo sala: ${room.code} (${room.groupName})`);
  }

  handleJoinRoom(socket, data) {
    const { code, name } = data;
    if (!code || !name) {
      socket.emit('error', { message: 'Codigo y nombre son requeridos' });
      return;
    }

    const room = this.roomManager.getRoom(code);
    if (!room) {
      socket.emit('error', { message: 'Sala no encontrada' });
      return;
    }

    const node = room.addNode(name.trim(), socket.id);
    socket.join(code);

    socket.emit('room-joined', {
      nodeId: node.id,
      label: node.label,
      subnetId: node.subnetId,
      state: room.getState(),
    });

    this.io.to(code).emit('state-update', room.getState());

    this.io.to(room.teacherSocketId).emit('student-joined', {
      nodeId: node.id,
      label: node.label,
      name: node.name,
      subnetId: node.subnetId,
      totalNodes: room.nodeCount(),
    });

    console.log(`[Server] Nodo registrado en sala ${code}: ${node.label} (${name}) - Subnet: ${node.subnetId}`);
  }

  handleToggleNode(socket) {
    const room = this.roomManager.getRoomByStudentSocket(socket.id);
    if (!room) return;

    const node = room.getNodeBySocket(socket.id);
    if (node) {
      room.toggleNode(node.id);
      this.io.to(room.code).emit('state-update', room.getState());
      console.log(`[Server] Nodo toggled en sala ${room.code}: ${node.label} -> on: ${room.getNode(node.id).on}`);
    }
  }

  handleDisconnect(socket) {
    const teacherRoom = this.roomManager.getRoomByTeacherSocket(socket.id);
    if (teacherRoom) {
      this.io.to(teacherRoom.code).emit('room-closed', {
        reason: 'El profesor cerro la sala',
      });

      for (const node of teacherRoom.nodes.values()) {
        if (node.socketId) {
          this.io.to(node.socketId).emit('room-closed', {
            reason: 'El profesor cerro la sala',
          });
        }
      }

      this.roomManager.removeRoom(teacherRoom.code);
      console.log(`[Server] Sala cerrada por profesor: ${teacherRoom.code}`);
      return;
    }

    const result = this.roomManager.removeStudentFromAllRooms(socket.id);
    if (result) {
      const { room, node } = result;
      this.io.to(room.code).emit('state-update', room.getState());
      this.io.to(room.teacherSocketId).emit('student-left', {
        nodeId: node.id,
        label: node.label,
        name: node.name,
        totalNodes: room.nodeCount(),
      });
      console.log(`[Server] Nodo desconectado de sala ${room.code}: ${node.label} (${node.name})`);
    }
  }
}
