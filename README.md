# Tools Manager Frontend

Aplicación web para la gestión visual de herramientas, su inventario y sus estados. Está desarrollada con **Angular 21**, componentes standalone y Angular Material/CDK.

- **Aplicación desplegada:** https://tools-manager-frontend.netlify.app/tablero
- **Repositorio:** https://github.com/VictorHugoAguilar/tools-manager-frontend

## Índice

- [Descripción](#descripción)
- [Funcionalidades](#funcionalidades)
- [Tecnologías](#tecnologías)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Desarrollo local](#desarrollo-local)
- [Compilación](#compilación)
- [Backend y API](#backend-y-api)
- [Despliegue en Netlify](#despliegue-en-netlify)
- [ersionado automático](#versionado-automático)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Solución de problemas](#solución-de-problemas)
- [Changelog](#changelog)

## Descripción

Tools Manager Frontend es la interfaz de una aplicación de gestión de herramientas. Organiza las herramientas en un tablero visual por estados y ofrece secciones para consultar y administrar el inventario, las categorías, los reportes y la configuración.

El frontend se comunica con un backend mediante una API. Si la API no responde o no devuelve datos, la aplicación dispone de un modo demo para facilitar la visualización de la interfaz.

## Funcionalidades

Las funcionalidades documentadas en el proyecto incluyen:

- **Tablero:** visualización de herramientas agrupadas por estado.
- **Inventario:** acceso a la vista de inventario.
- **Categorías:** acceso a la gestión de categorías.
- **Reportes:** acceso a la sección de reportes.
- **Configuración:** acceso a las opciones de configuración.
- **Búsqueda en vivo:** búsqueda de herramientas desde la interfaz.
- **Alta y edición:** creación y modificación de herramientas.
- **Cambio rápido de estado:** actualización del estado desde la interfaz.
- **Imágenes:** subida y eliminación de imágenes mediante la API.
- **Notificaciones visuales:** mensajes tipo toast y confirmaciones para acciones sensibles.
- **Modo demo:** alternativa visual cuando la API no responde o no devuelve datos.

> Las operaciones de datos dependen de la disponibilidad y configuración del backend. Este repositorio contiene el frontend.

## Tecnologías

| Tecnología | Uso |
|---|---|
| Angular 21 | Framework de la aplicación |
| TypeScript | Lenguaje de desarrollo |
| Angular Material | Componentes de interfaz |
| Angular CDK | Utilidades para interfaces Angular |
| RxJS | Programación reactiva |
| Chart.js y ng2-charts | Gráficos |
| jsPDF y jspdf-autotable | Generación de documentos PDF |
| xlsx | Trabajo con hojas de cálculo |
| qrcode | Generación de códigos QR |
| ESLint y angular-eslint | Análisis estático del código |
| Netlify | Despliegue del frontend |

## Requisitos

- Node.js **20.19 o superior**, según los requisitos documentados del proyecto.
- npm, incluido normalmente con Node.js.
- Un backend compatible ejecutándose localmente en `http://localhost:3000` para trabajar con la API en desarrollo.

Comprueba las versiones instaladas:

```bash
node --version
npm --version
```

## Instalación

Clona el repositorio y entra en el directorio:

```bash
git clone https://github.com/VictorHugoAguilar/tools-manager-frontend.git
cd tools-manager-frontend
```

Instala las dependencias:

```bash
npm install
```

## Desarrollo local

Inicia el servidor de desarrollo:

```bash
npm start
```

Por defecto, Angular sirve la aplicación en:

http://localhost:4200

El script `npm start` utiliza `proxy.conf.json` para configurar el proxy de las peticiones `/api` durante el desarrollo. El backend debe estar disponible en `http://localhost:3000`, según la configuración prevista por el proyecto.

> Si la aplicación muestra datos de demo o no puede cargar información real, comprueba que el backend esté iniciado y que la configuración del proxy y de la API sea correcta.

## Compilación

Compilación de desarrollo:

```bash
npm run build
```

Compilación de producción:

```bash
npm run build:prod
```

El directorio publicado por la configuración de Netlify es:

```text
dist/frontend/browser
```

Otros scripts disponibles:

| Comando | Descripción |
|---|---|
| `npm start` | Inicia Angular con la configuración de proxy |
| `npm run start:prod` | Inicia Angular con configuración de producción y proxy |
| `npm run build` | Compila la aplicación |
| `npm run build:prod` | Compila para producción |
| `npm run watch` | Recompila al detectar cambios |
| `npm run lint` | Ejecuta el análisis estático configurado |

## Backend y API

El frontend necesita un backend compatible para realizar las operaciones que dependen de datos reales, como la gestión de herramientas y sus imágenes.

En desarrollo, el proyecto está preparado para trabajar con un backend local en:

```text
http://localhost:3000
```

Las peticiones de la aplicación utilizan la ruta `/api`. La configuración de desarrollo se encuentra en:

```text
proxy.conf.json
```

Si el backend utiliza otra dirección o puerto, revisa y adapta la configuración del proxy a la URL real de la API.

**Nota:** este repositorio corresponde al frontend. Las instrucciones para instalar o desplegar el backend deben consultarse en el repositorio correspondiente a ese servicio.

## Despliegue en Netlify

El proyecto incluye un archivo `netlify.toml` con la configuración de compilación y publicación.

Configuración utilizada:

| Parámetro | Valor |
|---|---|
| Comando de build | `npm run build` |
| Directorio de publicación | `dist/frontend/browser` |
| Rutas de la aplicación | Redirección a `index.html` para soportar navegación de una SPA |

Para desplegar en Netlify:

1. Importa el repositorio desde GitHub en Netlify.
2. Configura el comando de compilación como `npm run build`.
3. Configura el directorio de publicación como `dist/frontend/browser`.
4. Comprueba que el backend de producción esté desplegado y sea accesible desde el frontend.
5. Verifica la configuración de las llamadas a la API para producción; el proxy local de desarrollo no sustituye la configuración del backend en producción.
6. Ejecuta el despliegue y comprueba las rutas principales de la aplicación.

La redirección SPA definida en `netlify.toml` permite que las rutas de Angular se resuelvan a través de `index.html`.

## Versionado automático

El repositorio dispone de una GitHub Action para actualizar la versión al fusionar una Pull Request dirigida a `main`.

La acción identifica el tipo de cambio en el título o en la descripción de la Pull Request mediante una de estas marcas:

- `[patch]`: incrementa la versión de parche, por ejemplo `1.2.3` → `1.2.4`.
- `[minor]`: incrementa la versión menor, por ejemplo `1.2.3` → `1.3.0`.
- `[major]`: incrementa la versión principal, por ejemplo `1.2.3` → `2.0.0`.

Cuando encuentra una marca válida, la automatización actualiza `package.json`, crea un commit y una etiqueta con el link hacia la `Pull Request` (por ejemplo, `1.2.4`). El commit de versión incluye `[skip ci]` para ayudar a evitar ejecuciones recursivas de CI.

Si no encuentra ninguna de las marcas, no modifica la versión.

> El comportamiento final depende de la configuración vigente de los workflows en `.github/workflows/`.

## Versionado semántico

Como decía, una parte importante del versionado es decidir las normas y reglas que puedes usar para denominar a las versiones. Existen muchos sistemas para designar las versiones, o incluso podrías crearte las tuyas propias.

Sin embargo, existe un sistema llamado versionado semántico que es ampliamente utilizado en la comunidad de desarrollo. Aunque no es el único, se ha convertido en prácticamente en un estándar aceptado.

El versionado semántico se compone de tres números que identifican la versión:

```shell
$ MAJOR.MINOR.PATCH
```

Veamos cada una de esas partes, y las reglas que llevan a incrementarlos:

- **MAJOR**: El número de versión mayor indica cambios significativos e incompatibles con versiones anteriores (generalmente, se incrementa cuando se introducen cambios que pueden romper la compatibilidad con versiones anteriores).

- **MINOR**: El número de versión menor señala nuevas funcionalidades o mejoras que son retrocompatibles (al incrementar el número menor, se indica que se han añadido características sin afectar la compatibilidad con versiones previas).

- **PATCH**: El número de versión de parche indica correcciones de errores o ajustes menores que no afectan la compatibilidad hacia atrás.

Además, existe otra regla. Cada vez que se incremente un número, los que están “por debajo” vuelven a cero. Es decir:

Si cambia `MAJOR`, reiniciamos a cero `MINOR` y `PATCH`
Si cambia `MINOR`, reiniciamos a cero `PATCH`

### Ejemplo de versionado semántico

Seguramente sea más sencillo y si lo vemos con un ejemplo. Supongamos que tu tienes un programa o una librería, y lanzas una versión inicial v1.0.0

```
1.0.0 - Versión inicial
```

Después surgen algunos errores, que arreglo en Bugfix. Como solo son bugs, incremento el campo `PATH`.

```
1.0.0 - Versión inicial
1.0.1 - Bugfix uno
1.0.2 - Bugfix dos
```

Pasa más tiempo, y te apetece añadirle una nueva funcionalidad. Estas funcionalidades son compatibles con la anterior versión, así que incremento el campo `MINOR`. Además, al incrementar el `MINOR` tengo que volver `PATCH` a cero.

```
1.1.0 - Nueva funcionalidad
```

Por supuesto cada nueva versión puede tener sus propios `PATCH`, que generalmente corresponderían con resolución de bugs o cambios muy pequeños.

```
1.1.0 - Nueva funcionalidad
1.1.1 - Bugfix
1.1.2 - Bugfix
```

Ahora pasa aún más tiempo, y quieres añadir más funcionalidades. Pero, en esta ocasión, vas a hacer cambios importantes que rompen la compatibilidad con la versión anterior.

En ese caso, incremento la versión `MAJOR`, y tanto `MINOR` como `PATH` vuelven a cero.

```
2.0.0 - Cambio que rompe compatibilidad
```

### Qué es romper la compatibilidad

He dicho varias veces que el criterio para definir si es una versión `MAJOR` o `MINOR` es si se rompe compatibilidad. Pero que significa eso de “romper la compatibilidad”. Vamos a verlo en más detalle con un ejemplo.

Imagina que te has hecho una librería que genera códigos QR. La sintaxis para generar los códigos es muy sencilla, simplemente le pasas el texto que quieres dentro del QR, y la ruta donde guardar el QR generado..

```
// v1.0
generateQR('mi texto', 'path_image')
```

Ahora añades un parámetro opcional para cambiar el color del código QR. Esto es un cambio que no rompe compatibilidad. Todo código que estuviera usando tu librería va a seguir funcionando.

```
// v1.1 ahora hay un parámetro opcional de color
generateQR('mi texto', 'path_image', 'pink')

// si no pones el color, funciona igual que la v1.0. No rompe compatibilidad
generateQR('mi texto', 'path_image')
```

Pero, por ejemplo, en alguno momento tu librería admite tantas opciones que pasarlo como parámetros no es práctico. Así que te lías la manta a la cabeza, y creas un nuevo objeto que se llame options y que se pasa a la función generateQR.

```
// v2.0
options = { path: 'path_image', color: 'pink');
		   
generateQR('mi_texto', options);
```

Nade que estuviera usando tu librería v1.0 va a poder usarla. Así que es un cambio que rompe la compatibilidad y por tanto la nueva versión debe ser v2.0.

### Ruptura de compatibilidad parcial

No quiero ser pesado, pero es importante entender lo de romper la compatibilidad. Tú rompes la compatibilidad incluso aunque no ocurra en todos los casos.

Olvidemos un momento la v2.0 anterior, y volvamos al caso donde tenías la v1.0.

```
// v1.0
generateQR('mi texto', 'path_image')
```

Imaginad que (vete tu a saber porqué motivo, es un ejemplo) tu nueva versión de generador de código no va a aceptar el carácter -. *(por ejemplo, porque lo usas internamente para “vete tu a saber porqué”).

Sea como sea, a partir de ahora si alguien quiere usar un - en tu librería, van a tener que ‘escaparlo’, poniendo \-.

```
// v1.0
generateQR('mi-texto', 'path_image')

// v2.0 se deben escapar los caracteres especiales
generateQR('mi\-texto', 'path_image', 'pink')
```

La mayoría de programas que usen tu librería, que no usaban el carácter - para nada, les va a funcionar sin problemas.

Pero justo al pobre que ha tenido la mala suerte de sí usar un -, le va a petar su programa de mala manera. Así que es un cambio de versión `MAJOR`, aunque solo se rompa en ciertos casos.

## Estructura del proyecto

Estructura principal identificada en el repositorio:

```text
tools-manager-frontend/
├── .github/
│   └── workflows/     # Automatizaciones de GitHub Actions
├── scripts/            # Scripts auxiliares
├── src/                # Código fuente Angular
├── angular.json        # Configuración de Angular CLI
├── netlify.toml        # Configuración de build y despliegue en Netlify
├── package.json        # Dependencias, scripts y versión
├── proxy.conf.json     # Configuración del proxy de desarrollo
├── tsconfig.json       # Configuración de TypeScript
└── README.md
```

## Solución de problemas

### La aplicación no muestra datos reales

- Comprueba que el backend esté ejecutándose.
- Verifica la URL y el puerto de la API.
- Revisa `proxy.conf.json` y la configuración de producción.
- Consulta la consola del navegador y la pestaña Network para identificar errores de red.

### Las rutas funcionan al navegar, pero no al recargar la página

Comprueba que Netlify esté aplicando la redirección de rutas de una SPA configurada en `netlify.toml`.

### Falla la compilación

- Comprueba la versión de Node.js y npm.
- Instala las dependencias con `npm install`.
- Ejecuta `npm run build` y revisa el mensaje de error completo.

---

## Changelog

Los cambios relevantes de cada versión se documentan en esta sección.

El formato sigue una estructura inspirada en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado sigue los principios de [Semantic Versioning](https://semver.org/lang/es/).

### Tipos de cambios

- `Added` para funcionalidades nuevas.
- `Changed` para los cambios en las funcionalidades existentes.
- `Deprecated` para indicar que una característica o funcionalidad está obsoleta y que se eliminará en las próximas versiones.
- `Removed` para las características en desuso que se eliminaron en esta versión.
- `Fixed` para corrección de errores.
- `Security` en caso de vulnerabilidades.

---

### [3.2.8](https://github.com/VictorHugoAguilar/tools-manager-frontend/pull/58) (2026-10-27)

- Added: Añadida la sección de changelog al README.
- Fixed: Eliminado un workflow de GitHub y actualizado el nombre del workflow de versión.
- Fixed: Cambiado el encabezado del changelog de H1 a H3.

### [3.3.0](https://github.com/VictorHugoAguilar/tools-manager-frontend/pull/72) (2026-10-27)

- Added: Se crea un servicio para controlar las imagenes que no cargan
- Added: Se implementa el servicio que se ha creado
- Fixed: Se arregla el fallo de la carga del icono

### [4.0.0](https://github.com/VictorHugoAguilar/tools-manager-frontend/pull/74) (2026-10-29)

- Added: se crea la nueva página para controlar los consumibles del taller
- Added: se introduce la confirmacion de la eliminacion de cualquier componente
- Added: se añade nuevo sevicio para crear las categorias de los materiales
- Added: se modifica la visual para cargar de la bd las categorias de los materiales
- Added: cambio de nombre de la nueva página y sus rutas
- Fixed: sincronizar los estilos de las páginas de almacenamiento

### [5.0.0](https://github.com/VictorHugoAguilar/tools-manager-frontend/pull/76) (2026-10-30)

- Added: se crean los servicios para consumir los nuevos endpoint de autenticación
- Added: se crea el nuevo modelo para usuarios
- Added: se añade página de login
- Added: se añade la página del perfil del usuario
- Added: se añade la página de registro de usuario
- Added: se añade la página de usuario
- Added: se añade la página de reset password
- Added: se crea un guard para el uso de los permisos del usuario
- Added: se añade las rutas nuevas y se enlaza las nuevas funcionalidad en el menu
- Changed: se cambia como se muestra la fecha en los changelog de los títulos
- Changed: se modifica los estilos visuales de la subida de avatar de usuarios
- Changed: se modifican los changelog para que cumplan la nueva semántica

<!-- CHANGELOG-PR-78-START -->
### [5.1.0](https://github.com/VictorHugoAguilar/tools-manager-frontend/pull/78) (2026-10-30)

- Fixed: cambio del flujo guardado de dato modificados
- Changed: añadimos en la pagina del login un icono en lugar de texto
- Changed: se modifica y añade los iconos para ver la contraseña o para ocultarla en la pagina de crear nuevo perfil

<!-- CHANGELOG-PR-78-END -->

<!-- CHANGELOG-PR-80-START -->
### [6.0.0](https://github.com/VictorHugoAguilar/tools-manager-frontend/pull/80) (2026-10-30)

- Added: se añaden la nueva pagina para la lista de tareas
- Added: se añaden los servicios para las lista de tareas
- Changed: se añaden en la rutas la nueva página de lista de tareas
- Added: se añade en la barra de navegacion la nueva pagina
- Added: se crea un nuevo modelo de datos para las lista de tareas
- Changed: se modifican los subpaneles para que mantengan el mismo estilo en todas las páginas

<!-- CHANGELOG-PR-80-END -->

<!-- CHANGELOG-PR-88-START -->
### [7.0.0](https://github.com/VictorHugoAguilar/tools-manager-frontend/pull/88) (2026-11-02)

- Added: generación de nuevo modelo de datos para la página de tareas
- Added: se añaden los nuevos servicios para la interconexión con el backend
- Added: se añade la nueva ruta de la página de tareas
- Added: se añade la página nueva Tareas
- Changed: se quita etiqueta de @deprecated de una función de un servicio de almacenamiento en el storage

<!-- CHANGELOG-PR-88-END -->

<!-- CHANGELOG-PR-90-START -->
### [7.0.1](https://github.com/VictorHugoAguilar/tools-manager-frontend/pull/90) (2026-11-02)

- Fixed: se arregla la implementacion y se añade en las rutas las propiedades showGlobalSearch

<!-- CHANGELOG-PR-90-END -->

<!-- CHANGELOG-PR-92-START -->
### [7.1.0](https://github.com/VictorHugoAguilar/tools-manager-frontend/pull/92) (2026-11-02)

- Changed: cambio en las propiedades de las rutas
- Changed: cambio de aspecto visual en las listas de tareas y tareas
- Changed: modificado footer de la tarea se modifica la distribucion, se cambia la fecha en otro formato (12 jun, 21 abr, 25 dic)
- Changed: se modifica el detalle de la tarea y la modificacion de la tarea
- Fixed: se modifica en la confirmación de la eliminación para que no se quede debajo del modal de modificar tarea.
- Fixed: se modifica el tamaño y la posicion de los botones en los detalles de las tareas
- Changed: se añade la subida de archivos en los detalles de las tareas.
- Changed: cambio de nombres, y unificación de headers
- Fixed: cambio de avisos y errores en el budgets

<!-- CHANGELOG-PR-92-END -->

<!-- CHANGELOG-PR-94-START -->
### [7.2.0](https://github.com/VictorHugoAguilar/tools-manager-frontend/pull/94) (2026-11-03)

- Changed: cambios visuales en el headers

<!-- CHANGELOG-PR-94-END -->

<!-- CHANGELOG-PR-96-START -->
### [7.3.0](https://github.com/VictorHugoAguilar/tools-manager-frontend/pull/96) (2026-11-03)

- Changed: Se modifican los estilos de los filtros de la lista de tareas
- Changed: se ha reorganizado las filas para que muestren, en orden, check, título, etiquetas, contador de comentarios cuando los haya, fecha (Hoy, Mañana o día y mes), avatar de un responsable y menú
- Changed: se cambia al crear o editar una tarea, el selector permite elegir responsables entre el propietario y los miembros del proyecto. Las asignaciones se limitan a las personas con acceso al proyecto; en tareas sin proyecto, solo se permite asignar al usuario actual.
- Changed: se modifica los colores fijos por un color picket para elegir de una pantonera el color
- Changed: se ha modificado el detalle de la tarea, el objetivo es que se parezca visualmente a la imagen del mockup-detaller-tarea.
- Changed: se actualiza el formulario de Nueva tarea para acercarlo al mockup: título y descripción destacados, campos de lista/sección/prioridad/fecha, etiquetas con un selector modal y opción para crear una etiqueta, responsable único con avatar, subtareas temporales y carga de archivos por selección o arrastrar y soltar. Conservé hora, importancia y repetición en Más opciones.
- Changed: se ha adaptado los adjuntos al estilo del mockup en el detalle y en los formularios de creación y edición: filas con icono, nombre, tamaño, descarga y menú para quitar o eliminar; botón «Añadir archivo» y aviso del límite de 15 MB. También se bloquean los archivos que superen ese límite.
- Fixed: se modifica que al abrir la edición, el formulario recibía la tarea del listado, que no incluye los detalles de repetición. Aunque la consulta del detalle sí los devuelve, esos campos no se copiaban al formulario.
- Fixed: se ha dividido los estilos de Todo List en tres hojas independientes, manteniendo la encapsulación de Angular y sin tocar las plantillas ni la lógica. El CSS de cada hoja queda por debajo de 26 kB: página 21,7 kB, detalle 12,6 kB y formulario 9,6 kB. Angular aplica anyComponentStyle por hoja individual.

<!-- CHANGELOG-PR-96-END -->
