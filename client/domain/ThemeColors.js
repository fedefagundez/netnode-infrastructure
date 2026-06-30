function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function getThemeColors() {
  const dark = isDark();
  return {
    bg: dark ? '#1e0a3c' : '#e8deff',
    grid: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
    edge: dark ? '#4e1d96' : '#c4b5e0',
    edgeDead: dark ? '#2d1054' : '#d6c6f0',
    nodeActive: '#1368ce',
    nodeActiveBr: '#0e4f9e',
    nodeOff: dark ? '#57534e' : '#a899b8',
    nodeOffBr: dark ? '#44403c' : '#8a7c9a',
    nodeMe: '#26890c',
    nodeMeBr: '#1a6a08',
    lblOn: '#fff',
    lblOff: dark ? '#8b6fb0' : '#7a6599',
    hover: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    routerFill: '#e67e22',
    routerBorder: '#d35400',
    routerOff: '#7f8c8d',
    routerOffBorder: '#95a5a6',
    dnsFill: '#9b59b6',
    dnsBorder: '#8e44ad',
    firewallFill: '#e74c3c',
    firewallBorder: '#c0392b',
    infraOff: '#7f8c8d',
    infraOffBorder: '#95a5a6',
    packet: '#d89e00',
    packetBorder: '#b8860b',
    packetGlow: '#d89e0044',
    dnsPacket: '#e74c3c',
    dnsPacketBorder: '#c0392b',
    dnsPacketGlow: '#e74c3c44',
    infraLabel: '#fff',
    clientLabel: dark ? '#c4b5e0' : '#4a3570',
    clientLabelMe: dark ? '#0e4f9e' : '#1a6a08',
    textPrimary: dark ? '#c4b5e0' : '#4a3570',
    textSecondary: dark ? '#f0c896' : '#7d4e1e',
    textDns: dark ? '#d4b8e8' : '#5b2c6f',
    textFirewall: dark ? '#f5b7b1' : '#922b21',
  };
}

export { isDark, getThemeColors };
