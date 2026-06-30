# Plan de Integración Redis - NetNode Chat

## Objetivo

Convertir el almacenamiento in-memory del servidor a Redis para lograr:
- Persistencia durante la sesión (recuperación ante caídas)
- Limpieza automática con TTL (como Kahoot)
- Escalabilidad para múltiples maestras simultáneas

---

## Estado Actual

```
server/
├── domain/
│   ├── Room.js           ← Almacena todo en Maps/Arrays (in-memory)
│   ├── RoomManager.js    ← Map de salas (in-memory)
│   ├── MessageLog.js     ← Array de mensajes (in-memory)
│   ├── TopologyBuilder.js ← Funciones puras (sin estado)
│   └── pathfinding.js    ← BFS puro (sin estado)
├── infrastructure/
│   └── SocketServer.js   ← Maneja eventos Socket.IO
└── index.js              ← Punto de entrada
```

**Problema actual:** Todo se pierde al reiniciar el servidor. Sin persistencia, sin limpieza automática.

---

## Arquitectura Objetivo

```
server/
├── domain/
│   ├── Room.js           ← Lógica de negocio (sin cambios mayores)
│   ├── RoomManager.js    ← Orquestador (usa repositorio)
│   ├── MessageLog.js     ← Se reemplaza por Redis
│   ├── TopologyBuilder.js ← Sin cambios
│   └── pathfinding.js    ← Sin cambios
├── infrastructure/
│   ├── SocketServer.js   ← Maneja eventos (sin cambios mayores)
│   ├── redis/
│   │   ├── client.js     ← Conexión Redis
│   │   └── repositories/
│   │       ├── RoomRepository.js    ← CRUD de salas
│   │       ├── NodeRepository.js    ← CRUD de nodos
│   │       ├── EdgeRepository.js    ← CRUD de edges
│   │       └── MessageRepository.js ← CRUD de mensajes
│   └── adapters/
│       └── RoomAdapter.js ← Adapta Room a Redis (guarda/carga)
├── config/
│   └── redis.js          ← Configuración de Redis
└── index.js              ← Inicializa Redis + servidor
```

---

## Esquema de Claves Redis

```
# Índice global
rooms:active                                    -- SET de códigos de sala activos
socket:{socketId}:room                          -- STRING con código de sala (índice inverso)

# Datos de sala
room:{code}:meta                                -- HASH { groupName, topology, createdAt, teacherName, teacherSocketId }
room:{code}:nextNodeId                          -- STRING (entero, auto-increment)

# Nodos
room:{code}:nodes                               -- SET de node IDs
room:{code}:node:{id}                           -- HASH { id, label, name, socketId, on, x, y }

# Edges
room:{code}:edges                               -- SET de strings "fromId-toId" (normalizado)

# Mensajes
room:{code}:messages:all                        -- LIST de objetos JSON
room:{code}:messages:pair:{minId}-{maxId}       -- LIST de objetos JSON (para getChatLog)

# TTL automático (expira después de 2 horas sin actividad)
room:{code}:meta                                -- EXPIRE 7200
room:{code}:nodes                               -- EXPIRE 7200
... (todas las claves de la sala)
```

---

## Fases de Implementación

### Fase 1: Infraestructura Redis (1 día)

**Archivos a crear:**
1. `server/config/redis.js` - Configuración
2. `server/infrastructure/redis/client.js` - Conexión Redis
3. `server/infrastructure/repositories/RoomRepository.js` - CRUD salas
4. `server/infrastructure/repositories/NodeRepository.js` - CRUD nodos
5. `server/infrastructure/repositories/EdgeRepository.js` - CRUD edges
6. `server/infrastructure/repositories/MessageRepository.js` - CRUD mensajes

**Tareas:**
- [ ] Instalar dependencia: `npm install ioredis`
- [ ] Crear cliente Redis con reconexión automática
- [ ] Implementar RoomRepository:
  - `create(code, data)` → Crea todas las claves con TTL
  - `get(code)` → Carga meta + nodos + edges
  - `delete(code)` → Elimina todas las claves de la sala
  - `exists(code)` → Verifica si la sala existe
  - `setActive(code)` → Agrega a rooms:active
  - `getActive()` → Retorna todas las salas activas
- [ ] Implementar NodeRepository:
  - `add(roomCode, nodeData)` → Agrega nodo a SET + crea HASH
  - `get(roomCode, nodeId)` → Carga nodo desde HASH
  - `getAll(roomCode)` → Carga todos los nodos
  - `update(roomCode, nodeId, data)` → Actualiza HASH
  - `delete(roomCode, nodeId)` → Elimina de SET + HASH
  - `getBySocket(roomCode, socketId)` → Búsqueda por socket ID
- [ ] Implementar EdgeRepository:
  - `add(roomCode, fromId, toId)` → Agrega a SET
  - `getAll(roomCode)` → Carga todos los edges
  - `delete(roomCode, fromId, toId)` → Elimina del SET
  - `deleteByNode(roomCode, nodeId)` → Elimina edges de un nodo
- [ ] Implementar MessageRepository:
  - `add(roomCode, message)` → RPUSH a messages:all + messages:pair
  - `getByPair(roomCode, nodeA, nodeB)` → LRANGE de messages:pair
  - `getAll(roomCode)` → LRANGE de messages:all
  - `count(roomCode)` → LLEN de messages:all

### Fase 2: Adaptador Room (1 día)

**Archivos a crear:**
1. `server/infrastructure/adapters/RoomAdapter.js` - Convierte Room ↔ Redis

**Archivos a modificar:**
1. `server/domain/Room.js` - Agregar métodos `save()` y `load()`

**Tareas:**
- [ ] Crear RoomAdapter con métodos:
  - `save(room)` → Guarda Room completo en Redis
  - `load(roomCode)` → Carga Room desde Redis
  - `refresh(roomCode)` → Renueva TTL de todas las claves
  - `delete(roomCode)` → Elimina todas las claves
- [ ] Modificar Room.js:
  - Agregar método `async save()` que llame al adaptador
  - Agregar método estático `async load(code)` que cargue desde Redis
  - Mantener la interfaz pública igual (compatibilidad)

### Fase 3: Integración con SocketServer (1 día)

**Archivos a modificar:**
1. `server/infrastructure/SocketServer.js` - Usar repositorios en vez de RoomManager
2. `server/domain/RoomManager.js` - Adaptar para usar Redis

**Cambios en eventos Socket.IO:**
- [ ] `create-room`:
  - Crear sala en Redis con TTL de 2 horas
  - Guardar metadatos: groupName, teacherName, topology
  - Retornar código de sala
- [ ] `join-room`:
  - Verificar que la sala existe en Redis
  - Agregar nodo a Redis
  - Conectar nodos según topología (TopologyBuilder)
  - Guardar edges actualizados
  - Emitir state-update
- [ ] `send-message`:
  - Cargar sala desde Redis
  - Ejecutar BFS (carga nodos + edges en memoria temporal)
  - Guardar mensaje en Redis
  - Emitir packet + receive-message
- [ ] `toggle-node`:
  - Actualizar estado on/off en Redis
  - Emitir state-update
- [ ] `change-topology`:
  - Reconstruir edges con TopologyBuilder
  - Guardar nuevos edges en Redis
  - Emitir state-update
- [ ] `disconnect`:
  - Si es profesor: eliminar sala completa de Redis
  - Si es alumno: eliminar nodo + sus edges
  - Emitir相应的 eventos

### Fase 4: TTL y Limpieza Automática (0.5 días)

**Tareas:**
- [ ] Configurar TTL de 2 horas (7200 segundos) para todas las claves de sala
- [ ] Implementar refresh de TTL en cada evento de la sala
  - Cuando un alumno envía mensaje → refresh TTL
  - Cuando un alumno se une → refresh TTL
  - Cuando se cambia topología → refresh TTL
- [ ] Implementar limpieza de sala cuando expira:
  - Usar Redis Keyspace Notifications (optional)
  - O implementar verificación periódica en el servidor
- [ ] Configurar cleanup en disconnect del profesor:
  - Eliminar todas las claves de la sala inmediatamente
  - No esperar a que expire el TTL

### Fase 5: Testing y Optimización (0.5 días)

**Tareas:**
- [ ] Test unitarios para repositorios:
  - RoomRepository: create, get, delete, exists
  - NodeRepository: add, get, update, delete
  - EdgeRepository: add, getAll, delete
  - MessageRepository: add, getByPair, getAll
- [ ] Test de integración:
  - Crear sala → agregar nodos → enviar mensajes → verificar persistencia
  - Simular caída del servidor → reconectar → verificar que la sala persiste
- [ ] Test de TTL:
  - Crear sala → esperar expiración → verificar que se eliminó
  - Crear sala → mantener actividad → verificar que el TTL se renueva
- [ ] Benchmark de rendimiento:
  - Medir latencia de operaciones CRUD en Redis
  - Comparar con versión in-memory
  - Verificar que no hay memory leaks

---

## Dependencias

### Nuevas dependencias
```json
{
  "ioredis": "^5.3.2"
}
```

### Dependencias existentes (sin cambios)
```json
{
  "express": "^4.18.2",
  "socket.io": "^4.7.2"
}
```

---

## Configuración Redis

### Desarrollo (local)
```js
// server/config/redis.js
export default {
  host: 'localhost',
  port: 6379,
  // Sin contraseña en desarrollo
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
};
```

### Producción (ejemplo)
```js
export default {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  tls: process.env.NODE_ENV === 'production' ? {} : undefined,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
};
```

---

## Estrategia de Migración

### Opción A: Migración completa (recomendada)
1. Implementar Redis desde cero
2. Mantener la interfaz de Room igual
3. Cambiar solo la capa de persistencia
4. Ventaja: Limpio, sin deuda técnica
5. Desventaja: Más trabajo inicial

### Opción B: Híbrida (fallback)
1. Intentar Redis, si falla usar in-memory
2. Ventaja: Funciona sin Redis instalado
3. Desventaja: Complejidad adicional, dos caminos de código

**Recomendación: Opción A** (migración completa)

---

## Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Redis no disponible | Alto | Health checks + reconexión automática |
| Race conditions en nodos | Alto | Usar INCR para nextNodeId + MULTI/EXEC para operaciones atómicas |
| Pérdida de datos al reiniciar | Medio | Configurar AOF persistence en Redis |
| Complejidad de debugging | Medio | Logging estructurado + monitoreo de claves Redis |
| Performance degradation | Bajo | Benchmark periódico + optimización de queries |

---

## Métricas de Éxito

| Métrica | Objetivo | Cómo medir |
|---------|----------|------------|
| Persistencia | 100% de datos sobreviven reinicio | Test de reinicio del servidor |
| Limpieza automática | Salas expiran en 2 horas | Test de TTL |
| Performance | <5ms latencia promedio | Benchmark con artillery |
| Escalabilidad | 50 salas simultáneas | Test de carga |
| Uso de memoria | <500MB con 50 salas | Monitoreo con redis-cli INFO |

---

## Cronograma

| Día | Fase | Entregable |
|-----|------|------------|
| 1 | Fase 1: Infraestructura Redis | Repositorios funcionando |
| 2 | Fase 2: Adaptador Room | Room lee/escribe en Redis |
| 3 | Fase 3: Integración SocketServer | Eventos usan Redis |
| 4 | Fase 4: TTL + Limpieza | Limpieza automática |
| 5 | Fase 5: Testing | Tests pasando + benchmark |

**Total: 5 días de desarrollo**

---

## Notas para el Desarrollador

1. **Mantener la interfaz pública de Room igual** - Los métodos `addNode()`, `removeNode()`, `bfs()`, etc. deben seguir funcionando igual. Solo cambia cómo se persisten los datos.

2. **Usar transacciones Redis cuando sea necesario** - Operaciones que modifican múltiples claves (ej: agregar nodo + edges + nextNodeId) deben ser atómicas.

3. **Cargar en memoria para BFS** - No implementar BFS nativo en Redis. Cargar nodos + edges, ejecutar BFS en Node.js, retornar resultado.

4. **Manejar errores de Redis** - Si Redis no está disponible, el servidor debe funcionar con fallback a in-memory (opcional) o retornar error claro.

5. **Monitorear uso de memoria** - Usar `redis-cli INFO memory` para verificar que no hay memory leaks.

---

## Referencias

- [ioredis Documentation](https://redis.github.io/iotoredis/)
- [Redis Data Types](https://redis.io/docs/data-types/)
- [Redis TTL](https://redis.io/commands/expire/)
- [Socket.io + Redis](https://socket.io/docs/v4/redis-adapter/)
