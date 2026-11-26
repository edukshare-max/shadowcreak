# Expansión colaborativa de Cristian

Referencia del juego conservado: main, 14002fd. La implementación está organizada sobre el motor Canvas existente.

## Sistemas implementados

- Cinco personajes: Errante original, Granjero, Samurái rojo, Leñadora y Clériga. Reutilizan el esqueleto animado original con vestimenta, silueta y herramientas diferenciadas. Las habilidades tienen preparación, efecto y recuperación.
- Selección previa, vista animada, color de prenda y aspecto Veterano desbloqueable. Los cosméticos no cambian estadísticas.
- Cinco terrenos cultivables, preparación, semillas, crecimiento y plantas medicinales. El Granjero acelera el cultivo.
- Veintidós árboles naturales de tamaños diferentes, resistencia, golpes, caída y madera recogible una sola vez. La Leñadora obtiene velocidad y madera adicionales.
- Espíritus neutral, hostil y domable. La Clériga puede vincularlos; ayudan mediante curación, daño o defensa.
- Seis pociones con ingredientes, consumo, efecto, duración y reutilización.
- Tres cavernas conectadas al mundo, bloques destruibles, oscuridad, minerales, enemigos y cofres. Se conserva el progreso de las regiones de superficie al entrar y salir.
- Trece recursos minerales, incluyendo los diez metales principales, piedra, carbón y diamante. Los picos inferiores no dañan minerales de categorías superiores.
- Mesa de trabajo, horno/yunque, alquimia, empalizadas, antorchas y desmontaje con recuperación parcial de materiales.
- Lingotes, picos, hachas, azadas, espadas/katanas, arcos y armaduras de diez materiales. Las mejoras no permiten reemplazar equipo por una versión inferior.
- Casco, pechera y grebas con defensa progresiva y aspecto en el personaje. Bonificaciones de conjunto: oro mejora extracción; platino defensa; tungsteno resistencia; infernal protección ambiental; paladio regeneración; adamantita daño; titanio defensa y protección.
- Inventario y forja originales en I; taller ampliado en B; atlas de minerales, alquimia, espíritus y conexión.
- Servidor real de salas con identificación, chat, inventarios, fabricación, recursos, construcciones, enemigos, jefe, reaparición, reconexión y persistencia del mundo. El servidor utiliza las fábricas, geometría y patrones originales compartidos con el cliente.

## Compatibilidad

Se conserva la clave umbra.expedition.v3 y la versión original del guardado. La expansión añade campos opcionales; una partida antigua recibe el Errante y sus datos de expansión iniciales sin perder vida, recursos ni equipo. Las sesiones online no escriben sobre la expedición individual.

A/D, flechas, W, Espacio, J, Shift/K, E, Q, I, M, 1/2/3 y Esc conservan sus funciones. Los valores originales de movimiento y salto del Errante no cambian. Las tres regiones, enemigos, Vhal, refugios y final continúan disponibles.

## Archivos nuevos

- data/expansion.json: catálogo editable de personajes, materiales, pociones y servidor.
- src/expansion-rules.js: reglas compartidas y migración.
- src/expansion.js y src/expansion.css: sistemas, interfaz y dibujo de la expansión.
- src/world-core.js: geometría, actores y algoritmos originales compartidos.
- src/room-client.js: transporte y recuperación de sesión.
- server/index.mjs: proceso de salas y persistencia.
- tests/progression.test.mjs y tests/server.test.mjs: reglas e integración de red.
- assets/umbra-mark.svg: icono del juego.
- package-lock.json: dependencia WebSocket reproducible.
- docs/ARQUITECTURA_EXPANSION.md, MULTIJUGADOR.md e INFORME_EXPANSION.md: integración, ejecución y entrega.

## Archivos modificados

src/game.js integra los módulos mediante un adaptador. El HTML carga los estilos e incorpora ayuda; index.html añade el icono. package.json define pruebas y servidor. scripts/validate.mjs comprueba los módulos y catálogos nuevos. El flujo de GitHub instala la dependencia y ejecuta las pruebas antes de preparar el sitio. .gitignore excluye los mundos guardados. .devcontainer expone el puerto del servidor. README explica las rutas y controles nuevos.

## Verificación

Ejecutar npm test y npm run build. Las pruebas de reglas cubren progresión de picos, ausencia de duplicación, agricultura, tala, recetas, pociones, espíritus, cosméticos y compatibilidad. La prueba del servidor conecta dos clientes reales, rechaza desplazamientos imposibles y acciones repetidas, comparte recursos y recupera una sala tras reiniciar.

La comprobación de navegador cubre selección, movimiento, salto, agricultura, cavernas, paneles, migración de partidas, vista móvil y dos clientes independientes con movimiento y chat. Los informes de QA locales se conservan fuera del paquete publicado, en .umbra-qa.

Resultados de la integración: doce pruebas automatizadas de reglas y servidor; catorce comprobaciones de expansión en navegador; veintinueve comprobaciones de regresión del juego original, incluido el combate y las dos fases de Vhal, la muerte, reaparición y el final. Los dos contextos de navegador se conectaron a un servidor local real.

## Errores corregidos durante la integración

- Se conservó la prioridad de los nodos y refugios originales al compartir E con agricultura y tala.
- Se corrigió una dependencia del cálculo de interpolación de las animaciones de Vhal al extraer el módulo compartido. Hay una prueba específica para anticipación, golpes y fases.
- La restauración distingue vida inicial del personaje y vida guardada; no cura partidas anteriores por accidente.
- Se conservan posición y enemigos de cada caverna y el estado del mundo de superficie.
- Se ajustaron las tarjetas de personajes para evitar desplazamiento horizontal y se retiraron los indicadores de refugio y región de superficie dentro de las cavernas.
- Se verificó que las sesiones online no sustituyen la partida individual y que un recurso, cofre u objeto no se recoge dos veces.

## Pendiente y límites

La publicación web incorpora un servidor WSS gratuito de pruebas en Render, configurado en el catálogo. Permite probar salas desde la web; las salas de esa instancia no sobreviven a reinicios o despliegues. El almacenamiento persistente para progreso duradero y las pruebas con jugadores en distintas redes domésticas siguen pendientes. Véase MULTIJUGADOR.md.

Se recomiendan partidas cooperativas de prueba para ajustar tiempos, distribución y economía con Cristian. Las pruebas locales no constituyen una prueba de carga prolongada ni una validación de latencia entre redes domésticas. El servidor admite una sola instancia, identificación por sesión y ocho jugadores conectados; no incluye cuentas permanentes ni moderación.
