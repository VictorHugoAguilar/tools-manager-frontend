# Frontend Angular

Frontend de gestion de herramientas inspirado en el diseno de referencia, construido con Angular 21 standalone.

## Requisitos

- Node.js 20.19 o superior
- Backend ejecutandose en `http://localhost:3000`

## Instalacion

```bash
npm install
```

## Desarrollo

```bash
npm start
```

El frontend arranca por defecto en `http://localhost:4200` y usa `proxy.conf.json` para reenviar `/api` al backend local.

## Build

```bash
npm run build
```

## Funcionalidad incluida

- Tablero visual por estados
- Rutas para Tablero, Inventario, Categorias, Reportes y Configuracion
- Busqueda en vivo
- Alta y edicion de herramientas
- Cambio rapido de estado
- Subida y borrado de imagenes conectados con la API
- Toasts globales y confirmaciones visuales para acciones sensibles
- Modo demo si la API no responde o no devuelve datos

## Change Version Package.json

By default, Render does not create PR previews. To create a preview for a specific PR, do any of the following: Add the `render-preview` tag to the PR (GitHub only activates when a PR is merged (not when closing it without merging)).

- Search for `[major], [minor], or [patch]` in the PR title/body.
- If no tag is found, do nothing (no errors).
- Run `bump-version.js`, update `package.json`, and perform an automatic commit + tag (v1.2.3).
- The commit includes `[skip ci]` to prevent infinite loops.

## CHANGELOG 

<!-- CHANGELOG-PR-59-START -->
### v3.2.1

- Update README to include CHANGELOG section [patch]

<!-- CHANGELOG-PR-59-END -->

<!-- CHANGELOG-PR-61-START -->
### v3.2.2

- Add CHANGELOG section to README
- delete file action github and change name action bump version
- Change changelog header from H1 to H3

<!-- CHANGELOG-PR-61-END -->

<!-- CHANGELOG-PR-65-START -->
### [3.2.3] - $(date +'%Y-%m-%d')

- Fix formatting in bump-version-add-changelog.yml

<!-- CHANGELOG-PR-65-END -->

<!-- CHANGELOG-PR-66-START -->
### [3.2.4] - 2026-10-27

- Fix version formatting in bump-version workflow

<!-- CHANGELOG-PR-66-END -->
