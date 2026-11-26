# Integración de la expansión de Cristian

## Base examinada antes de modificar el juego

La referencia es main, commit 14002fd. No había otras ramas ni pull requests al iniciar esta integración. Motor propio en JavaScript, módulos ES y Canvas 2D; no utiliza Unity, Phaser ni un motor de física externo.

- Entrada: index.html y umbra_cronicas_del_umbral.html.
- src/game.js: bucle fijo a 120 Hz, gravedad 1390, caminar 205, correr 307, salto variable, dash, combos, arco, lanza, enemigos con anticipación y jefe Vhal en dos fases.
- Mundo: 7920 unidades, tres regiones, plataformas y salientes; nodos deterministas, tres refugios, guardado automático y final mediante monolito.
- Inventario: seis recetas originales, equipo permanente y consumibles. HUD, mapa, ayuda, pausa, controles táctiles y mezcla de audio existentes.
- Arte: personaje articulado dibujado en una superficie de 256 × 192 con píxeles, interpolación de articulaciones, animaciones y rastros. Se reutiliza como referencia de los nuevos personajes.
- Persistencia: localStorage, clave umbra.expedition.v3, versión 3. Las partidas existentes deben seguir cargando; los campos de expansión serán opcionales.
- Publicación: GitHub Actions valida y publica dist en GitHub Pages. Pages sirve archivos estáticos; un servidor WebSocket requiere un proceso externo.

## Integración

1. Mantener las funciones originales e introducir un adaptador con acceso explícito al jugador, mundo, dibujo y guardado.
2. Mantener el Errante sin cambios de identidad ni de física. Añadir cuatro especialidades sobre las animaciones existentes.
3. Guardar personajes, apariencia y mundo adicional dentro del mismo documento de guardado, con migración de partidas antiguas.
4. Compartir reglas de recursos, fabricación y progresión entre navegador y servidor. Los datos se editan en JSON.
5. Añadir cavernas como zonas conectadas al bosque, conservando las tres regiones originales y su progreso.
6. Validar cada cambio con pruebas de reglas, regresión de guardado y pruebas en navegador.
7. Preparar salas reales con autoridad del servidor sobre inventarios y acciones. La interfaz debe distinguir partida individual, conexión y desconexión. No presentar bots como jugadores.

## Contratos que se conservan

A/D, flechas, W, Espacio, J, Shift/K, E, Q, I, M, 1/2/3 y Esc conservan su función. Las nuevas acciones utilizan otras teclas. El inventario original, el mapa, los enemigos y el final continúan disponibles. Las apariencias no conceden estadísticas. Una herramienta inferior no extrae un mineral de una categoría superior.

## Verificación y entrega

La implementación y sus límites se documentarán en INFORME_EXPANSION.md. La integración se trabaja en expansion/cristian-supervivencia para que ambos puedan revisarla mediante una pull request. No se considera probado el multijugador hasta conectar dos clientes reales al mismo servidor.
