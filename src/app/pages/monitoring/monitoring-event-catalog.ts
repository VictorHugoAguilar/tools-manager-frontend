const EVENTS: Record<string, string> = {
  'frontend.runtime.error': 'Error de JavaScript en el navegador',
  'frontend.api.request.failed': 'El navegador recibió un error al llamar a la API',
  'frontend.route.changed': 'El usuario cambió de página',
  'frontend.tools.search.completed': 'El usuario buscó herramientas',
  'frontend.performance.measurement': 'Medida de rendimiento del navegador',
  'frontend.performance.page.loaded': 'La página terminó de cargar',
  'frontend.performance.first_contentful_paint': 'Primer contenido visible en pantalla',
  'frontend.performance.largest_contentful_paint': 'El contenido principal terminó de pintarse',
  'frontend.performance.long_task': 'El navegador se quedó bloqueado más de 200 ms',
  'frontend.performance.route_transition': 'Tiempo en cambiar de página',
  'frontend.collaboration.sync.completed': 'Sincronización del dibujo colaborativo completada',
  'frontend.collaboration.reconnected': 'El dibujo colaborativo se reconectó',
  'frontend.collaboration.persist.completed': 'El dibujo colaborativo se guardó',
  'frontend.telemetry.flush.failed': 'El navegador no pudo enviar su telemetría',
  'http.request.failed': 'El backend respondió con un error de servidor (5xx)',
  'api.action.completed': 'Acción de escritura completada en la API',
  'auth.access.denied': 'Acceso denegado (sin sesión o sin permiso)',
  'auth.login.succeeded': 'Inicio de sesión correcto',
  'auth.login.failed': 'Inicio de sesión fallido',
  'auth.logout.completed': 'Cierre de sesión',
  'auth.logout.failed': 'Fallo al cerrar sesión',
  'process.uncaught_exception': 'El proceso del backend lanzó una excepción no controlada',
  'process.unhandled_rejection': 'El proceso del backend tuvo una promesa rechazada sin tratar',
  'task_board.operation.completed': 'Operación en el tablero de tareas',
  'todo.operation.completed': 'Operación en la lista de tareas',
  'workshop_storage.operation.completed': 'Operación en el almacenamiento del taller',
  'tools.create.completed': 'Herramienta creada',
  'tools.update.completed': 'Herramienta modificada',
  'tools.state.completed': 'Estado de la herramienta cambiado',
  'tools.image.upload.completed': 'Imagen de herramienta subida',
  'tools.image.delete.completed': 'Imagen de herramienta eliminada',
  'tools.delete.completed': 'Herramienta eliminada',
  'tools.repair.create.completed': 'Reparación registrada',
  'tools.repair.update.completed': 'Reparación modificada',
  'tools.repair.delete.completed': 'Reparación eliminada',
  'storage.workshop.viewed': 'Consulta del almacenamiento del taller',
  'storage.workshop.searched': 'Búsqueda en el almacenamiento del taller',
  'storage.workshop.categories.viewed': 'Consulta de categorías del taller',
  'storage.boxes.viewed': 'Consulta de la lista de cajas',
  'storage.box.viewed': 'Consulta del detalle de una caja',
  'storage.boxes.searched': 'Búsqueda de cajas',
  'storage.shelf_config.viewed': 'Consulta de la configuración de estanterías',
  'websocket.connection.opened': 'Conexión WebSocket abierta',
  'websocket.connection.closed': 'Conexión WebSocket cerrada',
  'websocket.authentication.failed': 'Fallo de autenticación en una conexión WebSocket',
  'websocket.document.load.failed': 'No se pudo cargar un dibujo en la colaboración',
  'websocket.document.store.failed': 'No se pudo guardar un dibujo en la colaboración'
};

const AREAS: Record<string, string> = {
  task_board: 'Tablero de tareas', todo: 'Lista de tareas', drawing: 'Dibujo', tool: 'Herramienta', tools: 'Herramientas',
  workshop: 'Taller', storage: 'Almacenamiento', websocket: 'WebSocket', auth: 'Autenticación', frontend: 'Navegador',
  monitoring: 'Monitorización', tracing: 'Trazabilidad', session: 'Sesión', process: 'Proceso'
};

const VERBS: Record<string, string> = {
  created: 'creado', updated: 'modificado', deleted: 'eliminado', moved: 'movido', reordered: 'reordenado',
  archived: 'archivado', unarchived: 'desarchivado', restored: 'restaurado', completed: 'completado',
  reopened: 'reabierto', duplicated: 'duplicado', added: 'añadido', removed: 'quitado', accessed: 'consultado',
  viewed: 'consultado', searched: 'buscado', failed: 'fallido', opened: 'abierto', closed: 'cerrado'
};

// Para un nombre no catalogado, lo descompone en «Área · elemento: acción» en vez de mostrar solo el código.
export function describeEvent(eventName: string): string {
  const known = EVENTS[eventName];
  if (known) return known;
  const parts = eventName.split('.');
  if (parts.length < 2) return eventName;
  const verb = VERBS[parts.at(-1)!];
  if (!verb) return eventName;
  const area = AREAS[parts[0]] ?? parts[0];
  const subject = parts.slice(1, -1).map((part) => part.replace(/_/g, ' ')).join(' ');
  return subject ? `${area}: ${subject} ${verb}` : `${area}: ${verb}`;
}
