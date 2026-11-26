# Shadowcreak · UMBRA: Crónicas del Umbral

Videojuego para PC que se juega en el navegador y se publica desde GitHub Pages. El código y los datos se editan en este repositorio.

## Lanzamiento desde GitHub

Dirección prevista después de activar Pages: https://edukshare-max.github.io/shadowcreak/

Activación: Settings → Pages → Source → GitHub Actions. El plan actual no permite Pages desde este repositorio privado: hay que usar un plan compatible o autorizar que el repositorio sea público. Un repositorio público permite a cualquiera leer el código y los datos; solo los colaboradores autorizados pueden escribir cambios.

El flujo Actions → Validar y publicar UMBRA comprueba los datos, prepara el sitio y lo publica después de cada cambio en main. Si la validación falla, esa versión no se despliega. Las pull requests se comprueban sin reemplazar el juego publicado.

## Qué editar

| Archivo | Contenido |
| --- | --- |
| data/game-data.json | Vida de enemigos y jefe, ubicación de enemigos, nombres y costes de fabricación |
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

Requiere Git y Python 3 para servir los archivos; Node.js 22 o posterior para comprobar y preparar la publicación. No hay paquetes que instalar.

    git clone https://github.com/edukshare-max/shadowcreak.git
    cd shadowcreak
    python -m http.server 8000 --bind 127.0.0.1

Abrir http://localhost:8000. El juego usa módulos y carga datos JSON: debe abrirse mediante HTTP, no haciendo doble clic en el HTML.

    npm run check
    npm run build

En Windows PowerShell, si la política bloquea npm.ps1, usar npm.cmd run check y npm.cmd run build. La salida está en dist/ y no se incluye en Git.

## Datos y partidas

Los datos del mundo se versionan en GitHub. Las partidas y la preferencia de sonido se guardan en localStorage del navegador de cada jugador. No se sincronizan entre computadoras ni crean una sesión multijugador.

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

El sonido requiere una interacción con el juego. En móviles aparecen controles táctiles.
