class Node {
  constructor(id, x, y, label, name, on = true, type = 'client', subnetId = null) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.label = label;
    this.name = name;
    this.on = on;
    this.type = type;
    this.subnetId = subnetId;
  }
}

export { Node };
