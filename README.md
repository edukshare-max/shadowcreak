# Shadowcreak · UMBRA: Crónicas del Umbral

Base del videojuego de acción, aventura y supervivencia para trabajar juntos desde casa.

El juego está en `umbra_cronicas_del_umbral.html`: contiene la interfaz, los estilos, la lógica, las animaciones y el audio del bosque. `index.html` abre ese archivo. No necesita instalar paquetes ni compilar.

## Editar y jugar desde casa con Codespaces

1. Entrar con su propia cuenta de GitHub al [repositorio](https://github.com/edukshare-max/shadowcreak).
2. Seleccionar **Code → Codespaces → Create codespace on main**. Cada persona trabaja en su propio espacio.
3. Esperar a que termine la preparación. El servidor de vista previa se inicia en el puerto **8000**.
4. En la pestaña **Ports / Puertos**, abrir el puerto 8000 en el navegador. [Documentación de puertos de Codespaces](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace).
5. Editar `umbra_cronicas_del_umbral.html`, guardar y recargar la vista previa para probar.

Si la vista previa no arranca, ejecutar en la terminal:

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Detener el Codespace al terminar desde el menú de Codespaces de GitHub. Antes de crearlo, revisar la cuota y las condiciones de uso que muestre GitHub.

## Compartir cambios entre los dos

Guardar un archivo en el editor no lo sube a GitHub. Hay que hacer un commit y publicar la rama.

Antes de empezar una mejora, desde una terminal sin cambios pendientes:

```sh
git switch main
git pull --ff-only origin main
git switch -c mejora/nombre-de-la-mejora
```

Después de editar y probar:

```sh
git add .
git commit -m "Describe la mejora del juego"
git push -u origin HEAD
```

En GitHub, abrir **Compare & pull request**, describir el cambio y pedir al otro que lo revise. Cuando esté listo, usar **Merge pull request**. Al comenzar la siguiente tarea, volver a actualizar `main` y crear una nueva rama con otro nombre.

Para reducir conflictos, coordinar qué parte editará cada uno: el código actual del juego está en un único archivo. Si Git indica un conflicto, revisarlo antes de continuar; no usar `push --force`.

## Dar acceso a Cristian

Este repositorio es privado. Cuando Cristian tenga su cuenta:

1. El propietario entra en **Settings → Collaborators → Add people**.
2. Busca el nombre de usuario de Cristian y envía la invitación.
3. Cristian acepta la invitación con su propia cuenta.

No necesitan compartir contraseñas. [Guía de GitHub para invitar colaboradores](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-user-account-settings/inviting-collaborators-to-a-personal-repository).

## Jugar y editar en una computadora

Clonar el repositorio:

```sh
git clone https://github.com/edukshare-max/shadowcreak.git
cd shadowcreak
```

Abrir `umbra_cronicas_del_umbral.html` directamente en un navegador, o iniciar un servidor con Python 3:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Visitar <http://localhost:8000>. Para detener el servidor, pulsar **Ctrl+C**.

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

En pantallas móviles aparecen controles táctiles. El sonido se activa mediante una interacción con el juego. Las partidas y la preferencia de sonido se guardan en el navegador de cada persona; no se sincronizan con GitHub.

## Archivos

- `umbra_cronicas_del_umbral.html`: archivo principal que deben editar.
- `index.html`: entrada que lleva al juego.
- `.devcontainer/devcontainer.json`: entorno y vista previa de Codespaces.
- `.gitignore` y `.gitattributes`: exclusiones locales y formato de archivos para colaborar.

Esta base conserva la versión local del juego cargada el 25 de noviembre de 2026.
