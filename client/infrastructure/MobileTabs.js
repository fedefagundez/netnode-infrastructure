class MobileTabs {
  constructor() {
    this.tabs = document.querySelectorAll('.mobile-tab');
    this.chatPanel = document.querySelector('.chat-panel');
    this.networkPanel = document.querySelector('.network-panel');

    if (!this.tabs.length || !this.chatPanel || !this.networkPanel) return;

    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.apply();
      });
    });

    this.apply();
    window.addEventListener('resize', () => this.apply());
  }

  isMobile() {
    return window.innerWidth <= 768;
  }

  apply() {
    if (!this.isMobile()) {
      this.chatPanel.classList.remove('chat-hidden');
      this.networkPanel.style.display = '';
      return;
    }

    const active = document.querySelector('.mobile-tab.active');
    if (!active) return;

    const tab = active.dataset.tab;
    this.chatPanel.classList.toggle('chat-hidden', tab !== 'chat');
    this.networkPanel.style.display = tab !== 'network' ? 'none' : '';
    window.dispatchEvent(new Event('resize'));
  }
}

export { MobileTabs };
