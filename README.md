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
- [Versionado automático](#versionado-automático)
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

Cuando encuentra una marca válida, la automatización actualiza `package.json`, crea un commit y una etiqueta Git con el prefijo `v` (por ejemplo, `v1.2.4`). El commit de versión incluye `[skip ci]` para ayudar a evitar ejecuciones recursivas de CI.

Si no encuentra ninguna de las marcas, no modifica la versión.

> El comportamiento final depende de la configuración vigente de los workflows en `.github/workflows/`.

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

### [3.2.4] - 2026-10-27

- Añadida la sección de changelog al README.
- Eliminado un workflow de GitHub y actualizado el nombre del workflow de versión.
- Cambiado el encabezado del changelog de H1 a H3.

<!-- CHANGELOG-PR-67-START -->
### [3.2.5]($PR_URL) - 2026-10-27

- Include PR URL in version format for changelog

<!-- CHANGELOG-PR-67-END -->

<!-- CHANGELOG-PR-68-START -->
### [3.2.6](https://github.com/VictorHugoAguilar/tools-manager-frontend/pull/68) - 2026-10-27

- Link version to merged PR URL in workflow

<!-- CHANGELOG-PR-68-END -->

<!-- CHANGELOG-PR-69-START -->
### [[3.2.7](https://github.com/VictorHugoAguilar/tools-manager-frontend/pull/69)] - 2026-10-27

- Fix markdown formatting for version link in workflow

<!-- CHANGELOG-PR-69-END -->
