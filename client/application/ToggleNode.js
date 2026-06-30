class ToggleNode {
  constructor(transport) {
    this.transport = transport;
  }

  execute() {
    this.transport.toggleNode();
  }
}

export { ToggleNode };
