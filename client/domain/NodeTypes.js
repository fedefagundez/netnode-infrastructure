const NODE_TYPES = {
  CLIENT: 'client',
  ROUTER: 'router',
  DNS: 'dns',
  FIREWALL: 'firewall',
};

const NODE_TYPE_INFO = {
  [NODE_TYPES.CLIENT]: {
    label: 'Computadora',
    description: 'Un dispositivo que envia y recibe mensajes',
    icon: 'circle',
  },
  [NODE_TYPES.ROUTER]: {
    label: 'Router',
    description: 'Decide por donde viajan los paquetes para llegar a su destino',
    icon: 'diamond',
  },
  [NODE_TYPES.DNS]: {
    label: 'Servidor DNS',
    description: 'Traduce nombres (ej: "Maria") en direcciones de red',
    icon: 'book',
  },
  [NODE_TYPES.FIREWALL]: {
    label: 'Firewall',
    description: 'Filtra que mensajes pueden pasar y cuales bloquea',
    icon: 'shield',
  },
};

export { NODE_TYPES, NODE_TYPE_INFO };
