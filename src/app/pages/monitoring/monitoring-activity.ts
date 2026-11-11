import { MonitoringEvent } from '../../services/monitoring-api.service';

const STORAGE_READ_LABELS = new Map([
  ['storage.workshop.viewed', 'Consulta del inventario del taller'],
  ['storage.workshop.searched', 'Búsqueda en el inventario del taller'],
  ['storage.workshop.categories.viewed', 'Consulta de categorías del taller'],
  ['storage.boxes.viewed', 'Consulta de cajas'],
  ['storage.box.viewed', 'Consulta de una caja'],
  ['storage.boxes.searched', 'Búsqueda en cajas'],
  ['storage.shelf_config.viewed', 'Consulta de configuración de estantes']
]);

export interface MonitoringActivity {
  eventId: string;
  receivedAt: string;
  label: string;
  statusCode: number | null;
  traceId?: string;
}

export function recentStorageActivity(events: MonitoringEvent[]): MonitoringActivity[] {
  return events.flatMap((event) => {
    const label = event.service === 'backend' ? STORAGE_READ_LABELS.get(event.eventName) : undefined;
    if (!label) return [];
    return [{
      eventId: event.eventId,
      receivedAt: event.receivedAt,
      label,
      statusCode: event.http?.statusCode ?? null,
      ...(event.traceId ? { traceId: event.traceId } : {})
    }];
  });
}
