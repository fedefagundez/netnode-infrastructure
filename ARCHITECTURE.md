# NetNode Infrastructure — Arquitectura y Documentación

## Visión general

Simulador de red informática para el aula. Los docentes crean salas con infraestructura de red (DNS, routers, firewalls) y los alumnos se unen como nodos que envían mensajes que viajan por la red siguiendo shortest-path (BFS).

**Stack:** Node.js + Socket.io (servidor), Canvas API (cliente), Clean Architecture.

---

## Estructura del proyecto

```
netnode-infrastructure/
├── index.html                    # Shell HTML con 4 pantallas
├── style.css                     # Estilos completos (dark/light)
├── sounds.js                     # Efectos de sonido (Web Audio API)
├── server/
│   ├── index.js                  # Entry point del servidor
│   ├── package.json
│   ├── domain/
│   │   ├── Room.js               # Entidad principal: salas, nodos, subnets, DNS, firewall
│   │   ├── RoomManager.js        # Registro de salas activas
│   │   ├── TopologyBuilder.js    # Construcción de topologías (chain, star, ring, etc.)
│   │   ├── MessageLog.js         # Registro de mensajes
│   │   ├── pathfinding.js        # BFS shortest-path
│   │   └── NodeTypes.js          # Definición de tipos de nodo
│   └── infrastructure/
│       └── SocketServer.js       # Servidor Express + Socket.io
├── client/
│   ├── entry.js                  # Punto de entrada del cliente
│   ├── theme.js                  # Gestión de tema dark/light
│   ├── App.js                    # Orquestador principal del cliente
│   ├── domain/
│   │   ├── Camera.js             # Viewport: zoom, pan, coordenadas
│   │   ├── Network.js            # Grafo del lado del cliente
│   │   ├── Node.js               # Modelo de nodo
│   │   ├── Edge.js               # Modelo de arista
│   │   ├── layout.js             # Cálculo de posiciones por topología
│   │   ├── constants.js          # Constantes de animación, zoom, etc.
│   │   ├── findSpecialNodes.js   # Busca Router Central y DNS
│   │   ├── ThemeColors.js        # Paleta de colores unificada
│   │   └── NodeTypes.js          # Metadata de tipos de nodo
│   ├── application/
│   │   ├── SendMessage.js        # Enviar mensaje
│   │   ├── ToggleNode.js         # Prender/apagar nodo
│   │   ├── ReceiveMessage.js     # Almacenar mensajes recibidos
│   │   └── SentMessage.js        # Almacenar mensajes enviados
│   ├── infrastructure/
│   │   ├── NetworkClient.js      # Cliente Socket.io
│   │   ├── CanvasAdapter.js      # Adaptador del canvas DOM
│   │   ├── CanvasInteraction.js  # Zoom + drag compartido
│   │   └── MobileTabs.js         # Tabs responsive para móvil
│   └── presentation/
│       ├── CanvasRenderer.js     # Renderiza la red en el canvas del alumno
│       ├── TeacherDashboard.js   # Dashboard del docente
│       ├── ChatPanel.js          # Panel de chat del alumno
│       ├── NodeRenderer.js       # Renderizado de nodos (tipos por forma/color)
│       └── PacketAnimator.js     # Animación de paquetes + DNS query
├── test-layout.mjs               # Tests del algoritmo de layout
└── Dockerfile                    # Deploy con Docker
```

---

## Arquitectura Clean Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE (browser)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Presentation │→│ Application  │→│    Domain      │  │
│  │  (UI/Canvas) │  │ (Use Cases) │  │ (Entidades)   │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
│         ↑                                                │
│  ┌─────────────┐                                        │
│  │Infrastructure│ (Socket.io, CanvasAdapter, Interaction)│
│  └─────────────┘                                        │
└─────────────────────────┬───────────────────────────────┘
                          │ WebSocket
┌─────────────────────────┴───────────────────────────────┐
│                    SERVIDOR (Node.js)                    │
│  ┌─────────────┐  ┌──────────────┐                      │
│  │Infrastructure│→│    Domain     │                      │
│  │ (SocketServer)│ │ (Room, etc) │                      │
│  └─────────────┘  └──────────────┘                      │
└─────────────────────────────────────────────────────────┘
```

**Reglas de dependencia:**
- `Domain` no depende de nada externo
- `Application` depende solo de `Domain`
- `Infrastructure` implementa interfaces del `Domain`
- `Presentation` depende de `Application` + `Domain`
- Las flechas van hacia adentro (hacia el Domain)

---

## Archivos por capa — Descripción detallada

### SERVIDOR

#### `server/index.js`
Entry point. Lee `PORT` del env (default 3001), crea e inicia `SocketServer`.

#### `server/domain/Room.js` — Entidad principal
Representa una sala (sesión de aula). Contiene:
- **Nodos**: Map de nodos (computadoras, routers, DNS, firewalls)
- **Aristas**: Conexiones entre nodos
- **Subnets**: Sub-redes con max 3 clientes cada una
- **DNS Table**: Resolución de nombres
- **Firewall Rules**: Reglas de filtrado
- **MessageLog**: Historial de mensajes

Flujo de infraestructura incremental:
1. `createSubnets()` → crea solo DNS + Router Central
2. Cuando entra el 1er alumno → `_ensureSubnet(0)` crea Router 1 + Firewall 1
3. Cuando se llena una subnet (3 alumnos) → `_ensureSubnet(n)` crea siguiente subnet

#### `server/domain/RoomManager.js`
Registro de salas activas. Genera códigos de 4 dígitos, busca salas por código, por socket del teacher, o por socket del alumno.

#### `server/domain/TopologyBuilder.js`
Construye aristas para 10 topologías (chain, star, ring, tree, mesh-partial, mesh-full, small-world, scale-free, random, grid). Soporta construcción incremental y completa.

#### `server/domain/pathfinding.js`
BFS (breadth-first search) para encontrar la ruta más corta entre dos nodos. Salta nodos apagados.

#### `server/domain/MessageLog.js`
Almacena mensajes. `log(from, to, text)` registra, `getChatLog(a, b)` recupera historial entre dos nodos.

#### `server/infrastructure/SocketServer.js`
Servidor Express + Socket.io. Maneja eventos:
- `create-room` → crea sala con DNS + Router Central
- `join-room` → agrega alumno, crea infraestructura si es necesario
- `send-message` → BFS + firewall check + broadcast de paquete
- `toggle-node` → apaga/prende nodo
- `disconnect` → limpieza de sala

### CLIENTE

#### `client/entry.js`
Punto de entrada. Importa `App`, inicializa audio en primer click, instancia `App`.

#### `client/theme.js`
IIFE que gestiona tema dark/light via localStorage. Sincroniza checkboxes y dispara evento `themechange`.

#### `client/App.js` — Orquestador principal
Maneja las 4 pantallas y coordina todas las capas:
- `setupLogin()` / `createRoom()` → flujo del docente
- `setupStudentJoin()` / `joinRoom()` → flujo del alumno
- `initStudentApp()` → configura Camera, Network, Canvas, Chat
- `initTeacherDashboard()` → configura dashboard del docente

#### `client/domain/Camera.js`
Viewport con zoom (min 0.25x, max 4x) y pan. Métodos de transformación:
- `scrToWorld(sx, sy)` → convierte coordenadas pantalla a mundo
- `worldToScr(wx, wy)` → convierte coordenadas mundo a pantalla
- `zoom(factor, cx, cy)` → zoom hacia un punto

#### `client/domain/Network.js`
Grafo del lado del cliente. Contiene nodos, aristas, y:
- `updateState(serverState)` → sincroniza con el servidor
- `assignPositions()` → calcula posiciones usando `layout.js`
- `getSpecialNodes()` → retorna Router Central y DNS

#### `client/domain/layout.js`
Algoritmo de layout para `school-network`:
1. Clasifica nodos por tipo (DNS, Router Central, Routers locales, Firewalls, Clients)
2. Calcula columnas proporcionales al número de clientes
3. DNS y Router Central centrados arriba
4. Cada subnet es una columna vertical: Router → Firewall → Clients

#### `client/domain/constants.js`
Constantes centralizadas:
- `ANIMATION` — velocidades y timeouts de animación
- `ZOOM` — límites de zoom (0.25x - 4x)
- `NODE` — radio mínimo y ratio de nodos
- `SUBNET` — max 3 clientes por subnet

#### `client/domain/findSpecialNodes.js`
Busca en un array de nodos el Router Central (`type=router, subnetId=null`) y el DNS (`type=dns`).

#### `client/domain/ThemeColors.js`
Paleta de colores unificada para dark/light mode. Exporta `isDark()` y `getThemeColors()` con todos los colores de la app.

#### `client/infrastructure/CanvasInteraction.js`
Helper compartido para interacción canvas. Maneja:
- **Zoom**: mouse wheel → `camera.zoom()`
- **Drag**: mousedown/mousemove/mouseup → `camera.offsetX/Y`

Usado tanto por el canvas del alumno como del docente.

#### `client/infrastructure/NetworkClient.js`
Cliente Socket.io. Conecta al servidor y maneja callbacks: `onRoomCreated`, `onRoomJoined`, `onStateUpdate`, `onPacket`, `onReceiveMessage`, `onMessageError`, `onDnsResponse`, `onRoomClosed`.

#### `client/presentation/CanvasRenderer.js`
Renderiza la red en el canvas del alumno:
- `draw()` → frame completo (grid, edges, nodes, packets)
- `drawGrid()` / `drawEdges()` / `drawNodes()` / `drawPackets()`
- `setupSpecialNodes()` → identifica Router Central y DNS para DNS query
- `animatePacket(path)` → inicia animación de paquete

#### `client/presentation/TeacherDashboard.js`
Dashboard del docente. Renderiza la red completa con:
- Canvas con zoom/pan (usa `CanvasInteraction`)
- Lista de chats activos
- Vista de chat individual
- Animación de paquetes (igual que el alumno)

#### `client/presentation/NodeRenderer.js`
Dibuja cada tipo de nodo en el canvas:
- `drawNode()` → clientes (círculo azul/verde/gris)
- `drawRouterNode()` → routers (cuadrado naranja rotado 45°)
- `drawDNSNode()` → DNS (círculo morado)
- `drawFirewallNode()` → firewalls (hexágono rojo)
- `drawPacket()` → paquete amarillo
- `drawDnsPacket()` → paquete de DNS query (rojo, más chico)

#### `client/presentation/PacketAnimator.js`
Motor de animación con soporte para:
- **Múltiples paquetes concurrentes**: cada paquete viaja independientemente
- **DNS query automática**: cuando un paquete llega al Router Central:
  1. El paquete completo se ve llegar al centro
  2. Se pausa el paquete
  3. Un paquete rojo va Router Central → DNS → Router Central
  4. El paquete original reanuda hacia su destino
- **Cola de animaciones**: si se envían varios mensajes, se procesan

---

## Flujo de un mensaje

```
1. Alumno escribe mensaje y hace clic "Enviar"
2. SendMessage.enviar() → socket.emit('send-message', {to, text})
3. SocketServer recibe → busca sender/receiver en Room
4. room.checkFirewall() → verifica reglas
5. room.bfs(sender, receiver) → calcula ruta shortest-path
6. socket.emit('packet', {path, text}) → a todos los sockets de la sala
7. Cliente recibe 'packet' → renderer.animatePacket(path)
8. PacketAnimator anima el paquete nodo por nodo
9. Si el paquete llega al Router Central → dispara DNS query
10. Cuando llega al destino → onReceiveMessage → chat se actualiza
```

## Flujo de infraestructura incremental

```
1. Teacher crea sala → createSubnets() → DNS + Router Central
2. 1er alumno entra → _ensureSubnet(0) → Router 1 + Firewall 1
3. 2do alumno → se asigna a subnet 0
4. 3er alumno → se asigna a subnet 0
5. 4to alumno → _ensureSubnet(1) → Router 2 + Firewall 2
6. El layout se recalcula automáticamente con más columnas
```

## Layout del canvas

El layout es **jerárquico por columnas**:

```
              D                    ← DNS centrado
              R                    ← Router Central centrado
    R    R    R    R    R          ← Routers distribuidos horizontalmente
    F    F    F    F    F          ← Firewalls debajo de su router
 C C C  C C  C C C  C C  C C C   ← Clients distribuidos por subnet
```

Cada subnet ocupa una columna cuyo ancho es proporcional a la cantidad de clientes.

---

## Tecnologías

| Tecnología | Uso |
|------------|-----|
| Node.js | Runtime del servidor |
| Express | HTTP + archivos estáticos |
| Socket.io | Comunicación WebSocket |
| Canvas API | Renderizado de la red |
| Web Audio API | Efectos de sonido |
| ES Modules | Sistema de módulos |
| Clean Architecture | Separación de capas |
