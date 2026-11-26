# ACTUALIZACIÓN PROFESIONAL DEL VIDEOJUEGO: MULTIJUGADOR, PERSONAJES, MINERÍA Y PROGRESIÓN

Actúa como un *desarrollador senior de videojuegos, diseñador de sistemas RPG, programador especializado en multijugador online y artista técnico de videojuegos 2D*.

Quiero que amplíes y mejores el videojuego que ya existe en este proyecto. No quiero que construyas un juego diferente desde cero ni que elimines funcionalidades existentes. Quiero una expansión completa, organizada, funcional y compatible con la arquitectura actual.

*REGLA PRINCIPAL: CONSERVAR EL JUEGO ORIGINAL.*

Antes de modificar cualquier archivo:
1. Analiza toda la estructura del proyecto.
2. Identifica el motor, lenguaje de programación, archivos principales y sistemas existentes.
3. Revisa los controles, físicas, animaciones, inventario, combate, enemigos, mapas, HUD y sistema de guardado.
4. Identifica las funcionalidades que ya están implementadas.
5. Diseña un plan de integración para evitar errores y conflictos.
6. Implementa los nuevos sistemas sin romper las mecánicas anteriores.

No reemplaces sistemas funcionales por versiones simplificadas.

---

# 1. MULTIJUGADOR ONLINE

Implementa un modo multijugador online que permita que varios jugadores participen simultáneamente en el mismo mundo.

Características:

- Crear partidas online.
- Unirse a partidas existentes.
- Sistema de salas.
- Identificación de jugadores.
- Sincronización de movimiento.
- Sincronización de ataques y habilidades.
- Sincronización de enemigos y jefes.
- Sincronización de recolección de recursos.
- Sincronización de objetos del suelo.
- Sincronización de construcción y destrucción.
- Sistema de chat entre jugadores.
- Indicadores de vida de los compañeros.
- Sistema de reaparición.
- Sistema de desconexión y reconexión.
- Guardado del progreso del mundo.

El multijugador debe permitir que los jugadores exploren, combatan, construyan, talen árboles, cultiven y minen simultáneamente.

*Requisitos técnicos:*
- Utiliza una arquitectura cliente-servidor.
- El servidor debe validar las acciones importantes para evitar duplicación de objetos y trampas.
- Sincroniza únicamente los datos necesarios para evitar problemas de rendimiento.
- Implementa interpolación de movimiento.
- Controla los errores de conexión.
- No simules un multijugador mediante personajes controlados por inteligencia artificial: deben ser jugadores reales conectados por internet.

Si la infraestructura actual no permite multijugador, prepara la arquitectura y los módulos necesarios, indicando qué configuración de servidor o servicios externos hacen falta. No afirmes que el multijugador online funciona hasta que pueda probarse con dos clientes reales.

---

# 2. SELECCIÓN DE PERSONAJES Y VESTIMENTA

Antes de comenzar una partida, agrega una pantalla de selección de personajes.

Quiero conservar el diseño artístico y la referencia visual del primer personaje existente.

A partir de esa misma referencia, crea cuatro personajes adicionales:

- 2 personajes masculinos.
- 2 personajes femeninos.

En total deben existir cinco personajes seleccionables.

Todos deben compartir:
- El mismo estilo artístico.
- Proporciones coherentes.
- Calidad de pixel art.
- Animaciones detalladas.
- Siluetas diferenciadas.
- Animaciones de caminar, correr, saltar, caer, atacar y recibir daño.
- Animaciones de habilidades especiales.

Cada personaje tendrá estadísticas, habilidades y herramientas propias.

## Personaje 1: Personaje original

Conserva el personaje inicial del proyecto.

No cambies su identidad visual ni sus habilidades existentes sin necesidad.

## Personaje 2: Granjero

<DISEÑO>
- Apariencia de granjero aventurero.
- Ropa de trabajo ligeramente desgastada.
- Sombrero de granjero.
- Herramienta principal: azada de cultivos.
</DISEÑO>

Habilidades:
- Puede preparar terrenos.
- Puede plantar semillas.
- Puede cultivar plantas curativas.
- Puede recolectar recursos agrícolas.
- Puede defenderse utilizando su azada.
- Tiene mayor velocidad de cultivo que los demás personajes.

Implementa un sistema de agricultura con:
- Semillas.
- Terrenos cultivables.
- Plantas.
- Tiempo de crecimiento.
- Recolección.
- Plantas medicinales.
- Mejoras agrícolas.

## Personaje 3: Samurái

<DISEÑO>
- Armadura de samurái.
- Vestimenta roja.
- Apariencia de guerrero experimentado.
- Katana de gran tamaño.
- Animaciones de combate pesadas y elegantes.
</DISEÑO>

Habilidades:
- Ataques cuerpo a cuerpo de gran daño.
- Corte especial que genere un impacto poderoso.
- Buena resistencia durante el dash.
- Mayor capacidad para resistir enfrentamientos directos.
- Animación especial para su habilidad definitiva.

Su habilidad principal debe tener:
- Preparación del ataque.
- Animación de corte.
- Efecto visual de energía.
- Zona de impacto.
- Daño elevado.
- Tiempo de recuperación equilibrado.

## Personaje 4: Leñadora

<DISEÑO>
- Personaje femenino especializado en supervivencia.
- Vestimenta de leñadora.
- Hacha como herramienta principal.
- Animaciones especiales de tala.
</DISEÑO>

Habilidades:
- Puede utilizar el hacha para combatir.
- Puede talar árboles.
- Obtiene madera y recursos adicionales.
- Puede cortar árboles más rápido que cualquier otro personaje.

*IMPORTANTE: MAPA UMBRA*

En el mapa llamado Umbra, distribuye árboles naturales de diferentes tamaños.

Los árboles deben:
- Tener diferentes apariencias.
- Poder talarse.
- Tener resistencia propia.
- Mostrar efectos de daño al recibir golpes.
- Caer mediante una animación.
- Dejar madera y recursos recolectables.

La leñadora debe tener una bonificación especial de velocidad de tala.

## Personaje 5: Clériga

<DISEÑO>
- Personaje femenino con vestimenta religiosa fantástica.
- Apariencia de clériga de un mundo de fantasía oscura.
- Bastón o arma ceremonial.
- Efectos visuales mágicos.
</DISEÑO>

Habilidades principales:

*Alquimia:*

Puede fabricar las siguientes pociones:

1. Poción de regeneración.
2. Poción de curación.
3. Poción de agallas.
4. Poción de piel de hierro.
5. Poción de piel de obsidiana.
6. Poción de resistencia.

Cada poción debe tener:
- Ingredientes necesarios.
- Receta.
- Tiempo de duración.
- Efectos.
- Animación de consumo.
- Efectos visuales.
- Tiempo de reutilización cuando corresponda.

*Espíritus domables:*

La clériga puede comunicarse con espíritus que encuentre en el mundo.

Implementa:
- Espíritus neutrales.
- Espíritus hostiles.
- Espíritus domables.
- Sistema de interacción.
- Sistema de vinculación.
- Habilidades especiales de cada espíritu.
- Seguimiento del jugador.
- Ayuda durante los combates.

Los espíritus deben tener comportamientos diferenciados y no ser simples objetos decorativos.

---

# 3. SISTEMA DE VESTIMENTA Y PERSONALIZACIÓN

Implementa una pantalla de personalización antes de entrar al mundo.

Permite:
- Elegir personaje.
- Elegir vestuario disponible.
- Cambiar colores de algunas prendas.
- Desbloquear apariencias.
- Guardar la apariencia seleccionada.
- Mostrar una vista previa animada.

Las vestimentas deben ser compatibles con las animaciones del personaje.

Los objetos cosméticos no deben modificar las estadísticas, salvo que exista un sistema de equipamiento que lo justifique.

---

# 4. SISTEMA DE MINERÍA Y CAVERNAS

Agrega cavernas subterráneas distribuidas por el mundo.

Quiero que la minería sea una parte importante de la progresión.

Las cavernas deben incluir:
- Diferentes profundidades.
- Minerales distribuidos por niveles.
- Paredes y bloques destruibles.
- Iluminación ambiental.
- Zonas oscuras.
- Recursos ocultos.
- Pequeñas cámaras subterráneas.
- Enemigos subterráneos.
- Cofres y recompensas.
- Efectos de partículas al minar.

Los minerales deben tener diferentes apariencias y niveles de rareza.

## 4.1 Primera categoría de minerales

Estos materiales podrán extraerse utilizando un pico de cobre:

| Mineral | Rareza |
|---|---|
| Piedra | Común |
| Carbón | Común |
| Plata | Poco común |
| Hierro | Poco común |
| Oro | Raro |
| Platino | Muy raro |

## 4.2 Segunda categoría de minerales

Estos materiales requerirán un pico de oro:

| Mineral | Rareza |
|---|---|
| Tungsteno | Raro |
| Diamante | Muy raro |
| Piedra infernal | Épico |

## 4.3 Tercera categoría de minerales

Estos materiales requerirán un pico de piedra infernal:

| Mineral | Rareza |
|---|---|
| Paladio | Épico |
| Adamantita | Legendario |
| Titanio | Legendario |

*IMPORTANTE:*

Respeta estrictamente los requisitos de minería.

Un pico inferior no debe poder destruir minerales de una categoría superior.

Implementa:
- Resistencia de cada bloque.
- Potencia de cada pico.
- Velocidad de extracción.
- Animaciones de minería.
- Sonidos.
- Partículas.
- Recolección automática del mineral.
- Cantidad de recursos obtenidos.

---

# 5. SISTEMA DE FABRICACIÓN Y PROGRESIÓN

Implementa un sistema de crafteo completo.

Quiero que todos los materiales tengan utilidad real dentro del juego.

Crea recetas para fabricar:

*Herramientas:*
- Picos.
- Hachas.
- Azadas.
- Arcos.

*Armas:*
- Espadas.
- Katanas.
- Armas especiales.
- Armas de materiales avanzados.

*Equipamiento:*
- Cascos.
- Pecheras.
- Grebas.
- Armaduras completas.

*Objetos adicionales:*
- Pociones.
- Materiales refinados.
- Lingotes.
- Mejoras.
- Accesorios.

Cada mineral debe permitir fabricar lingotes o componentes cuando corresponda.

Implementa estaciones de fabricación y recetas desbloqueables.

## 5.1 Mejoras de herramientas

Quiero que los picos, hachas, espadas y arcos puedan mejorarse sistemáticamente.

Cada herramienta debe tener:
- Daño o potencia.
- Velocidad.
- Durabilidad, si el juego utiliza ese sistema.
- Material de fabricación.
- Receta.
- Nivel de mejora.

Las mejoras deben seguir una progresión coherente.

Ejemplo de progresión:

Cobre → Hierro → Plata → Oro → Platino → Tungsteno → Piedra infernal → Paladio → Adamantita → Titanio.

No es necesario que todos los minerales tengan idéntico rendimiento: crea diferencias entre velocidad, daño, resistencia y eficiencia.

Evita que un objeto fabricado con un material inferior supere injustificadamente a uno avanzado.

---

# 6. SISTEMA DE ARMADURAS Y DEFENSA

Cada mineral debe permitir fabricar armaduras cuando corresponda.

Cada armadura tendrá:
- Casco.
- Pechera.
- Grebas.
- Defensa.
- Resistencia.
- Apariencia visual propia.
- Bonificaciones por conjunto completo.

La progresión debe respetar la rareza de los materiales.

Cuanto más avanzado y difícil de conseguir sea un mineral, mayor será el potencial defensivo de su armadura.

Sin embargo, cada conjunto debe tener características diferentes.

Ejemplos:
- Armadura de hierro: defensa equilibrada.
- Armadura de oro: bonificaciones especiales.
- Armadura de platino: mayor protección.
- Armadura de tungsteno: resistencia elevada.
- Armadura de piedra infernal: resistencia al fuego.
- Armadura de paladio: regeneración.
- Armadura de adamantita: bonificaciones ofensivas.
- Armadura de titanio: gran resistencia y protección.

Implementa efectos visuales al equipar cada conjunto.

Las armaduras deben reflejarse correctamente en el sprite del personaje y en sus animaciones.

---

# 7. EQUILIBRIO DE PERSONAJES Y OBJETOS

No quiero personajes excesivamente poderosos ni herramientas inútiles.

Implementa un sistema de estadísticas que permita equilibrar:

- Vida.
- Defensa.
- Daño.
- Velocidad.
- Resistencia.
- Velocidad de ataque.
- Velocidad de minería.
- Velocidad de tala.
- Capacidad de curación.
- Eficiencia de habilidades.

Cada personaje debe destacar en su especialidad, pero ninguno debe ser obligatorio para completar el juego.

El multijugador debe permitir que las especialidades se complementen.

---

# 8. INTERFAZ Y EXPERIENCIA DE USUARIO

Mantén el estilo visual original del videojuego.

Actualiza la interfaz para incluir:

- Selección de personajes.
- Personalización de vestimenta.
- Inventario.
- Equipamiento.
- Fabricación.
- Árbol de progresión.
- Recetas.
- Información de minerales.
- Estadísticas de herramientas.
- Pociones.
- Compañeros espirituales.
- Lista de jugadores conectados.
- Indicadores de compañeros.
- Estado de conexión.

Todas las ventanas deben ser funcionales y fáciles de utilizar.

No agregues botones decorativos que no realicen ninguna acción.

---

# 9. ARTE, ANIMACIONES Y CALIDAD VISUAL

Mantén una dirección artística coherente con el videojuego original.

Quiero una estética de fantasía oscura 2D con pixel art detallado.

Mejora:
- Animaciones de personajes.
- Animaciones de armas.
- Efectos de golpes.
- Efectos de habilidades.
- Animaciones de minería.
- Animaciones de tala.
- Animaciones de cultivo.
- Efectos de pociones.
- Iluminación de cavernas.
- Efectos ambientales.
- Animaciones de enemigos.

No utilices rectángulos geométricos como sustitutos de personajes, armas, minerales o escenarios definitivos.

Los sprites deben tener una silueta reconocible y coherencia visual.

---

# 10. REGLAS DE PROGRAMACIÓN Y COMPATIBILIDAD

Esta sección es obligatoria.

1. No elimines controles existentes.
2. No modifiques la física original sin una razón técnica justificada.
3. No elimines mapas ni enemigos existentes.
4. No sustituyas el sistema de guardado.
5. No rompas el inventario.
6. No elimines animaciones existentes.
7. No dupliques sistemas que ya funcionan.
8. No crees archivos innecesarios.
9. Utiliza código modular y reutilizable.
10. Evita dependencias innecesarias.
11. Mantén un rendimiento estable.
12. Comprueba que los nuevos sistemas se comuniquen correctamente.
13. Evita errores en consola.
14. Evita objetos duplicados en multijugador.
15. Guarda correctamente el progreso de cada jugador.

Cuando implementes una nueva funcionalidad, comprueba que no afecte las demás.

---

# 11. ORDEN DE IMPLEMENTACIÓN

Trabaja por etapas para evitar que el proyecto se rompa.

*ETAPA 1:* Analizar el proyecto y documentar su arquitectura.

*ETAPA 2:* Implementar los cuatro personajes nuevos y sus habilidades.

*ETAPA 3:* Implementar selección de personajes y vestimentas.

*ETAPA 4:* Implementar agricultura, tala y espíritus.

*ETAPA 5:* Implementar cavernas y generación de minerales.

*ETAPA 6:* Implementar herramientas, minería y crafteo.

*ETAPA 7:* Implementar armaduras, estadísticas y progresión.

*ETAPA 8:* Implementar el multijugador online.

*ETAPA 9:* Integrar el HUD y las interfaces.

*ETAPA 10:* Ejecutar pruebas generales y corregir errores.

Al terminar cada etapa:
- Comprueba que el juego siga funcionando.
- Revisa errores.
- Comprueba las mecánicas anteriores.
- Comprueba las nuevas funcionalidades.
- Corrige los problemas antes de continuar.

---

# 12. RESULTADO FINAL ESPERADO

Quiero que el resultado sea una expansión real de un videojuego de supervivencia, aventura y acción 2D.

Debe tener:

- Cinco personajes jugables.
- Selección y personalización.
- Multijugador online real.
- Especializaciones por personaje.
- Agricultura.
- Tala.
- Espíritus domables.
- Pociones.
- Cavernas.
- Diez tipos de minerales principales, además de los recursos comunes.
- Herramientas mejorables.
- Sistema de fabricación.
- Armaduras progresivas.
- Exploración.
- Combate.
- Guardado de progreso.
- Interfaz funcional.

*INSTRUCCIÓN FINAL:*

No quiero únicamente una demostración visual ni una lista de funcionalidades.

Quiero que implementes los sistemas directamente en el proyecto existente, reutilizando su código y manteniendo sus mecánicas originales.

Prioriza la funcionalidad real sobre las características simuladas.

Si alguna característica necesita infraestructura externa, explica exactamente qué falta y deja preparada la integración sin fingir que ya funciona.

Al finalizar, proporciona un informe con:
- Archivos modificados.
- Archivos nuevos.
- Sistemas implementados.
- Sistemas pendientes.
- Pruebas realizadas.
- Errores corregidos.
- Instrucciones para ejecutar el juego.
- Instrucciones para probar el multijugador con dos jugadores reales.