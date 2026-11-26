# Shadowcreak · UMBRA: Crónicas del Umbral

Videojuego para PC que se juega en el navegador y se publica desde GitHub Pages. El código y los datos se editan en este repositorio.

## Lanzamiento desde GitHub

Dirección del juego: https://edukshare-max.github.io/shadowcreak/

Para probar el multijugador, elegir Personajes y vestuario y después Partida online. El servidor público de pruebas ya viene configurado. El primer jugador deja la sala vacía y comparte el código con el segundo. T abre el chat. El servidor gratuito puede tardar un minuto en iniciar y pierde sus salas al reiniciarse; el progreso individual sigue guardado en el navegador.

GitHub Pages está activado con GitHub Actions como origen de publicación. El repositorio es público: cualquiera puede leer el código y los datos; solo los colaboradores autorizados pueden escribir cambios.

El flujo Actions → Validar y publicar UMBRA comprueba los datos, prepara el sitio y lo publica después de cada cambio en main. Si la validación falla, esa versión no se despliega. Las pull requests se comprueban sin reemplazar el juego publicado.

## Qué editar

| Archivo | Contenido |
| --- | --- |
| data/game-data.json | Vida de enemigos y jefe, ubicación de enemigos, nombres y costes de fabricación |
| data/expansion.json | Cinco personajes, minerales, pociones y dirección del servidor online |
| src/expansion-rules.js | Reglas compartidas de herramientas, recursos, cultivos, fabricación y equipo |
| src/expansion.js | Selección, personalización, cavernas, habilidades y paneles de expansión |
| src/world-core.js | Geometría, fábricas y patrones originales de enemigos y Vhal, compartidos con el servidor |
| server/index.mjs | Salas WebSocket, validación y guardado de mundos compartidos |
| src/game.js | Movimiento, combate, animaciones, guardado y reglas |
| src/game.css | Apariencia, controles y distribución |
| umbra_cronicas_del_umbral.html | Pantalla y estructura del juego |
| assets/audio/forest-ambience.mp3 | Grabación del ambiente del bosque |
| src/data-schema.js | Reglas de validación de los datos |

Para cambiar el coste de una espada, buscar la receta con id sword y editar cost en data/game-data.json. Los recursos permitidos son wood, ore y shard. Los tipos de enemigo son crawler, wolf, wisp y knight. enemyPlacements contiene parejas de tipo y posición horizontal. Mantener schemaVersion en 1 y conservar las seis recetas.

Las descripciones del equipo deben reflejar sus efectos reales en src/game.js. Si cambian el orden o la cantidad de enemigos, empezar una nueva expedición para probar el mapa completo.

## Actualizar y probar entre amigos

1. Cada amigo crea su cuenta y acepta la invitación del propietario desde Settings → Collaborators.
2. Abrir Code → Codespaces → Create codespace on main. El puerto 8000 ofrece una vista previa personal; abrirlo desde Ports.
3. Crear una rama, por ejemplo mejora/enemigos, editar los archivos y guardar.
4. Probar la vista previa y ejecutar npm run check.
5. Hacer commit, publicar la rama y abrir una pull request hacia main.
6. Revisar las comprobaciones y combinar la pull request.
7. Esperar a que Actions termine correctamente. Abrir o recargar la dirección del juego para probar la versión publicada. Usar Ctrl+F5 si el navegador conserva archivos antiguos.

La publicación tarda un tiempo después del commit. Los cambios sin guardar no se transmiten a las pestañas abiertas. Cada visitante ejecuta la versión que cargó. El archivo version.json del sitio identifica el commit publicado.

Codespaces tiene su propia vista previa y guardado. La dirección permanente para jugar es la de GitHub Pages. Detener el Codespace al terminar.

## Probar en una PC

El modo individual puede servirse con Python 3. Para desarrollar, ejecutar pruebas o iniciar el servidor de salas, usar Node.js 22 o posterior e instalar la única dependencia WebSocket con npm ci.

    git clone https://github.com/edukshare-max/shadowcreak.git
    cd shadowcreak
    npm ci --ignore-scripts
    python -m http.server 8000 --bind 127.0.0.1

Abrir http://localhost:8000. El juego usa módulos y carga datos JSON: debe abrirse mediante HTTP, no haciendo doble clic en el HTML.

    npm run check
    npm test
    npm run build

En Windows PowerShell, si la política bloquea npm.ps1, usar npm.cmd run check y npm.cmd run build. La salida está en dist/ y no se incluye en Git.

## Datos y partidas

Los catálogos del juego se versionan en GitHub. En individual se conserva la clave de guardado original umbra.expedition.v3 y se añaden los campos de expansión. Las partidas anteriores siguen siendo compatibles.

En online, el servidor conserva un mundo por sala y el progreso de cada jugador durante la sesión; esa sesión no sobrescribe la expedición individual. GitHub Pages sirve el cliente y Render ejecuta el servidor WebSocket de pruebas. Para conservar salas entre reinicios se necesita almacenamiento persistente. [Ejecución y prueba con dos jugadores](docs/MULTIJUGADOR.md).

[Prompt original de Cristian](docs/BRIEF_CRISTIAN.md) · [Arquitectura e integración](docs/ARQUITECTURA_EXPANSION.md) · [Informe de la expansión](docs/INFORME_EXPANSION.md).

No guardar contraseñas ni datos personales en los archivos: el sitio publicado los entrega al navegador.

## Controles

| Acción | Teclas |
| --- | --- |
| Moverse | A / D o flechas izquierda / derecha |
| Correr | W o flecha arriba mientras se avanza |
| Saltar | Espacio |
| Atacar | J |
| Esquivar | Shift o K |
| Interactuar / recolectar | E |
| Usar poción | Q |
| Inventario y fabricación | I |
| Mapa | M |
| Cambiar de arma | 1 / 2 / 3 |
| Pausar / cerrar panel | Esc |
| Taller, equipo y progresión | B |
| Minar un bloque cercano | R |
| Habilidad del personaje | F |
| Construcción | V |
| Desmontar construcción cercana | X |
| Sala y chat | T |

El sonido requiere una interacción con el juego. En móviles aparecen controles táctiles.

Elige personaje y vestimenta antes de una nueva expedición. E permite entrar en las cavernas del bosque, preparar y sembrar terrenos, cosechar y talar después de despejar los nodos originales. Los picos de oro y piedra infernal desbloquean las categorías 2 y 3. Los cosméticos no alteran estadísticas.
