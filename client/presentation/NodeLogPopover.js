const TYPE_LABELS = {
  router: 'Router',
  dns: 'DNS',
  firewall: 'Firewall',
};

class NodeLogPopover {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'node-log-popover hidden';
    document.body.appendChild(this.el);

    this._onClickOutside = (e) => {
      if (!this.el.contains(e.target)) this.hide();
    };
  }

  show(nodeName, nodeType, entries, x, y) {
    document.removeEventListener('click', this._onClickOutside);

    const label = TYPE_LABELS[nodeType] || nodeType;

    let html = `
      <div class="node-log-header">
        <span class="node-log-title">${label}: ${nodeName}</span>
        <button class="node-log-close">&times;</button>
      </div>`;

    if (entries.length === 0) {
      html += '<div class="node-log-empty">Sin eventos registrados</div>';
    } else {
      html += '<div class="node-log-list">';
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const time = new Date(e.timestamp).toLocaleTimeString('es-AR', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
        html += `<div class="node-log-entry"><span class="node-log-time">${time}</span> ${e.text}</div>`;
      }
      html += '</div>';
    }

    this.el.innerHTML = html;
    this.el.classList.remove('hidden');

    const list = this.el.querySelector('.node-log-list');
    if (list) list.scrollTop = list.scrollHeight;

    this.el.style.left = x + 'px';
    this.el.style.top = y + 'px';

    const rect = this.el.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      this.el.style.left = (x - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      this.el.style.top = (y - rect.height) + 'px';
    }

    this.el.querySelector('.node-log-close').addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });
    setTimeout(() => document.addEventListener('click', this._onClickOutside), 0);
  }

  hide() {
    this.el.classList.add('hidden');
    document.removeEventListener('click', this._onClickOutside);
  }
}

export { NodeLogPopover };
