# Salas online de Umbra

## Servidor público de pruebas

El cliente web utiliza por defecto `wss://shadowcreak-multiplayer.onrender.com/ws`, configurado en `data/expansion.json`. Abrir https://edukshare-max.github.io/shadowcreak/, elegir personaje desde Personajes y vestuario y entrar en Partida online.

El primer jugador introduce su nombre y deja la sala vacía para crearla. El segundo abre la misma web, introduce otro nombre y el código de seis caracteres de la primera sala. Ambos deben ver dos jugadores conectados. T abre el chat. No necesitan instalar programas ni cambiar la dirección del servidor.

Se ha elegido el plan Free de Render para esta prueba. Al estar inactivo puede tardar aproximadamente un minuto en iniciar; el cliente reintenta la conexión. Las salas y las credenciales de recuperación del servidor se pierden si el servicio se reinicia, se vuelve a desplegar o se suspende. No usar esta instancia para guardar progreso permanente. El guardado individual del navegador es independiente.

## Qué está preparado

El cliente utiliza WebSocket nativo. El servidor Node.js usa ws y conserva la autoridad sobre inventarios, recursos, minería, fabricación, construcciones, enemigos, Vhal, daño y reapariciones. El navegador predice el movimiento; el servidor verifica límites de desplazamiento y colisiones con bloques y empalizadas, y corrige movimientos rechazados.

Las salas admiten ocho jugadores conectados. Cada participante recibe un identificador y una credencial de recuperación. El inventario nunca se toma del navegador. Los números de secuencia impiden repetir acciones. La recogida de un objeto y el descuento de ingredientes ocurren una sola vez en el servidor.

Los clientes reciben instantáneas a 10 Hz, interpolan posiciones y reciben el estado adicional del mundo cuando cambia su revisión. Los enemigos se filtran por distancia. Al perder la conexión, el cliente pausa su control y trata de recuperar la sesión.

## Prueba con dos jugadores reales en una PC

Desde la carpeta del repositorio:

```sh
npm ci --ignore-scripts
npm run build
npm start
```

1. Abrir http://localhost:8080 en una ventana normal y en otra ventana de incógnito, o en dos navegadores diferentes.
2. En cada ventana seleccionar el personaje desde Personajes y vestuario y guardar su apariencia.
3. En la primera abrir Partida online. Servidor: ws://localhost:8080/ws. Introducir el nombre y dejar la sala vacía. Crear la sala.
4. Copiar el código de seis caracteres que aparece en el indicador de conexión.
5. En la segunda ventana introducir el mismo servidor y código de sala, con otro nombre.
6. Ambos indicadores deben mostrar dos jugadores. Moverse con A/D, atacar con J y abrir T para enviar un mensaje.
7. Acercarse al mismo recurso y recogerlo: no debe duplicarse. Una construcción realizada por un jugador aparece en el otro cliente.
8. Cerrar y reabrir la conexión usando Reconectar sesión. El mismo jugador conserva sus recursos. La credencial se conserva en sessionStorage de esa pestaña; no es una cuenta permanente.

Para probar desde dos computadoras de la misma red, abrir http://IP-DE-LA-PC-SERVIDOR:8080 y utilizar ws://IP-DE-LA-PC-SERVIDOR:8080/ws. El servidor escucha en 0.0.0.0. La red y el firewall deben permitir ese puerto.

## Publicar el servidor para jugar desde distintas casas

GitHub Pages es alojamiento estático; no ejecuta este servidor. Se necesita un servicio que ejecute Node.js 22 o posterior, admita conexiones WebSocket persistentes y proporcione HTTPS/WSS.

Configuración del servicio:

- Instalar: npm ci --ignore-scripts.
- Preparar el cliente: npm run build.
- Iniciar: npm start.
- PORT: puerto asignado por el servicio; el valor local predeterminado es 8080.
- HOST: 0.0.0.0.
- SAVE_DIR: ruta de una unidad persistente del servicio, por ejemplo /var/data/umbra-saves.
- ALLOWED_ORIGINS: https://edukshare-max.github.io. Se pueden separar varios orígenes exactos con comas.
- Comprobación de salud: GET /health.
- WebSocket: /ws.

Una vez desplegado, colocar wss://DOMINIO-DEL-SERVICIO/ws en serverUrl dentro de data/expansion.json, o introducir esa dirección en el formulario de salas. Desde GitHub Pages se exige wss://. No se debe colocar una contraseña de servidor ni una credencial de jugador en ese archivo público.

## Persistencia y operación

Los archivos JSON de las salas se guardan en server/saves por defecto, cada dos segundos y al desconectar. La escritura usa un archivo temporal y un reemplazo atómico. Se conservan salas, jugadores, equipo, enemigos, construcciones y recursos. SIGTERM/SIGINT esperan el guardado antes de terminar.

Usar una sola instancia de servidor con ese directorio. Varias instancias necesitarían almacenamiento coordinado y distribución de salas. Hacer copias de seguridad de SAVE_DIR; nunca subir ese directorio al repositorio. Una unidad efímera no conserva el mundo después de reiniciar el alojamiento.

## Alcance de la comprobación

Las pruebas automatizadas conectan dos clientes WebSocket reales y reinician el proceso para comprobar el guardado. La verificación de navegador conecta dos contextos independientes de Chrome al servidor local y comprueba jugadores, movimiento y chat.

La versión web está configurada para el servidor público de pruebas indicado arriba. Las pruebas automatizadas por internet usan clientes independientes; las partidas entre dos redes domésticas y la evaluación de latencia deben completarse con los jugadores. El sistema está pensado para partidas cooperativas entre amigos; no incluye cuentas de usuario, moderación de chat ni un sistema de competición con física completamente autoritativa.
