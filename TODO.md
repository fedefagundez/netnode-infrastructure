# TODO: Mejoras en Logs y Animaciones

## Logs de Red

### Formato actual (a mejorar)
- DNS: `Router1 → DNS: consulta "Rodri"`, `DNS: "Rodri" = A`, `DNS → Router1: respuesta "Rodri"`
- Mensajes: `Router1 → Firewall: A → B`, `Firewall: Permitida A → B`
- Firewall denegado: `Firewall: Denegada A → B`

### Problemas identificados
- [ ] Verificar que los logs se muestren correctamente en todos los nodos
- [ ] El path incluye ida y vuelta, revisar si corresponde mostrar ambas direcciones
- [ ] Simplificar formato si es necesario

### Mejoras pendientes
- [ ] Agregar logs de firewall para mensajes exitosos (actualmente solo denegados)
- [ ] Revisar logs de routers en red school-network (tienenSubnetId)
- [ ] Consistencia en formato de timestamps

## Animaciones de Firewall

### Estado actual
- [x] Animación `accept` se dispara cuando paquete llega al firewall
- [x] Animación `reject` se dispara cuando firewall bloquea mensaje
- [x] Evento `firewall-decision` se emite a todos los clientes

### Pendiente
- [ ] Verificar que la animación `accept` se dispara correctamente en el viaje de vuelta
- [ ] Probar flujo completo: mensaje → firewall permite → llega a destino
- [ ] Probar flujo completo: mensaje → firewall deniega → se muestra animación reject

## Iconos de Nodos (Canvas)

### Estado
- [x] Iconos PC, Router, DNS, Firewall copiados de red-iconos-canvas.html
- [ ] Verificar que se vean correctamente con diferentes tamaños de radio
- [ ] Animación LED del PC: revisar tamaño y posición

### Pendiente
- [ ] Ajustar tamaños si los iconos se ven muy pequeños/grandes
- [ ] Verificar que las animaciones (LED PC, lupa DNS, wave WiFi, escudo firewall) funcionen

## Tareas varias

- [ ] Eliminar console.log de debug agregados durante troubleshooting
- [ ] Verificar que TeacherDashboard recibe y muestra correctamente los logs de DNS
- [ ] Probar con topología school-network completa (múltiples subnets)
