import { Injectable, inject } from '@angular/core';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { IndexeddbPersistence } from 'y-indexeddb';
import * as Y from 'yjs';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import {
  DrawingConnectionState,
  DrawingPresenceUser,
  DrawingRole
} from '../models/drawing.model';
import { AuthUser } from '../models/auth.model';
import { environment } from '../../environments/environment';
import { DrawingApiService } from './drawing-api.service';

interface PendingPersistence {
  stateVector: Map<number, number>;
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

function stateVectorContains(persisted: Map<number, number>, target: Map<number, number>): boolean {
  return [...target].every(([clientId, clock]) => (persisted.get(clientId) ?? 0) >= clock);
}

export interface DrawingCollaborationConnection {
  readonly document: Y.Doc;
  readonly provider: HocuspocusProvider;
  readonly role$: BehaviorSubject<DrawingRole>;
  readonly state$: BehaviorSubject<DrawingConnectionState>;
  readonly participants$: BehaviorSubject<DrawingPresenceUser[]>;
  setCursor(cursor: { x: number; y: number } | null): void;
  setSelection(ids: string[]): void;
  persist(): Promise<void>;
  clearLocalCache(): Promise<void>;
  destroy(): void;
}

@Injectable({ providedIn: 'root' })
export class DrawingCollaborationService {
  private readonly api = inject(DrawingApiService);

  async connect(
    documentId: string,
    pageId: string,
    user: AuthUser
  ): Promise<DrawingCollaborationConnection> {
    if (!environment.drawingCollaborationUrl) {
      throw new Error('El servicio de colaboración no está configurado.');
    }

    const { session: initialSession } = await firstValueFrom(
      this.api.createCollaborationSession(documentId, pageId)
    );
    const document = new Y.Doc();
    const persistenceName = `drawing:${user.id}:${documentId}:${pageId}`;
    const persistence = new IndexeddbPersistence(
      persistenceName,
      document
    );
    await persistence.whenSynced;

    const state$ = new BehaviorSubject<DrawingConnectionState>('connecting');
    const role$ = new BehaviorSubject<DrawingRole>(initialSession.role);
    const participants$ = new BehaviorSubject<DrawingPresenceUser[]>([]);
    const providerReference: { current?: HocuspocusProvider } = {};
    let revoked = false;
    const pendingPersistence: PendingPersistence[] = [];

    const updateParticipants = (): void => {
      const awareness = providerReference.current?.awareness;
      if (!awareness) return;
      const participants = [...awareness.getStates().entries()]
        .filter(([clientId]) => clientId !== document.clientID)
        .flatMap(([, state]) => {
          if (!state || typeof state !== 'object') return [];
          const value = state as Record<string, unknown>;
          const userValue = value['user'];
          if (!userValue || typeof userValue !== 'object') return [];
          const peer = userValue as Record<string, unknown>;
          if (typeof peer['id'] !== 'string' || typeof peer['name'] !== 'string') return [];
          const cursorValue = value['cursor'];
          const cursor = cursorValue && typeof cursorValue === 'object'
            ? cursorValue as Record<string, unknown>
            : null;
          const x = cursor?.['x'];
          const y = cursor?.['y'];
          const selectedValue = value['selectedIds'];
          return [{
            id: peer['id'],
            name: peer['name'],
            profileImage: typeof peer['profileImage'] === 'string' ? peer['profileImage'] : '',
            color: typeof peer['color'] === 'string' ? peer['color'] : '#395b9a',
            cursor: typeof x === 'number' && Number.isFinite(x) &&
              typeof y === 'number' && Number.isFinite(y) ? { x, y } : null,
            selectedIds: Array.isArray(selectedValue)
              ? selectedValue.filter((id): id is string => typeof id === 'string').slice(0, 100)
              : []
          }];
        });
      participants$.next(participants);
    };

    const provider = new HocuspocusProvider({
      url: environment.drawingCollaborationUrl,
      name: initialSession.roomName,
      document,
      token: async () => {
        if (initialSession.token) {
          const token = initialSession.token;
          initialSession.token = '';
          return token;
        }
        const { session } = await firstValueFrom(
          this.api.createCollaborationSession(documentId, pageId)
        );
        role$.next(session.role);
        return session.token;
      },
      onStatus: ({ status }) => {
        if (!revoked) state$.next(status === 'connected' ? 'connected' : 'offline');
      },
      onSynced: ({ state }) => {
        if (state && !revoked) state$.next('connected');
      },
      onAwarenessChange: updateParticipants,
      onStateless: ({ payload }) => {
        let message: unknown;
        try {
          message = JSON.parse(payload);
        } catch {
          return;
        }
        if (!message || typeof message !== 'object') return;
        const event = message as Record<string, unknown>;
        if (event['type'] === 'drawing:persisted') {
          if (typeof event['stateVector'] !== 'string') return;
          const bytes = Uint8Array.from(atob(event['stateVector']), (character) => character.charCodeAt(0));
          const persistedVector = Y.decodeStateVector(bytes);
          for (let index = pendingPersistence.length - 1; index >= 0; index -= 1) {
            const pending = pendingPersistence[index];
            if (!pending || !stateVectorContains(persistedVector, pending.stateVector)) continue;
            clearTimeout(pending.timeout);
            pending.resolve();
            pendingPersistence.splice(index, 1);
          }
        } else if (event['type'] === 'access:role-changed' &&
          (event['role'] === 'Viewer' || event['role'] === 'Editor')) {
          role$.next(event['role']);
        } else if (event['type'] === 'access:revoked') {
          revoked = true;
          state$.next('revoked');
          this.api.clearShareToken(documentId);
          for (const pending of pendingPersistence.splice(0)) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Se ha revocado el acceso a esta pizarra.'));
          }
          void persistence.clearData().catch((error: unknown) => {
            console.error('Failed to clear revoked drawing cache', error);
          });
          provider.disconnect();
        }
      }
    });
    providerReference.current = provider;

    provider.awareness?.setLocalStateField('cursor', null);
    provider.awareness?.setLocalStateField('selectedIds', []);
    provider.awareness?.on('change', updateParticipants);
    provider.connect().catch((error: unknown) => {
      console.error('Drawing collaboration connection error', error);
      if (!revoked) {
        state$.next('offline');
        console.error('Drawing collaboration connection failed', error);
      }
    });

    return {
      document,
      provider,
      role$,
      state$,
      participants$,
      setCursor: (cursor) => provider.setAwarenessField('cursor', cursor),
      setSelection: (ids) => provider.setAwarenessField('selectedIds', ids.slice(0, 100)),
      clearLocalCache: async () => {
        ('Clearing local cache for drawing collaboration');
        await persistence.clearData();
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(persistenceName);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(
            request.error ?? new Error('No se pudo borrar la caché local de la pizarra.')
          );
          request.onblocked = () => reject(
            new Error('La caché local de la pizarra sigue abierta en otra pestaña.')
          );
        });
      },
      persist: async () => {
        if (!provider.isSynced) {
          throw new Error('Los cambios aún no se han sincronizado con el servidor.');
        }
        const targetStateVector = Y.decodeStateVector(Y.encodeStateVector(document));
        const persisted = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            const index = pendingPersistence.findIndex((pending) => pending.resolve === resolve);
            if (index >= 0) pendingPersistence.splice(index, 1);
            reject(new Error('El servidor no confirmó el guardado colaborativo.'));
          }, 15_000);
          pendingPersistence.push({ stateVector: targetStateVector, resolve, reject, timeout });
        });
        provider.flushPendingUpdates();
        await persisted;
      },
      destroy: () => {
        for (const pending of pendingPersistence.splice(0)) {
          clearTimeout(pending.timeout);
          pending.reject(new Error('La conexión de colaboración se ha cerrado.'));
        }
        provider.awareness?.off('change', updateParticipants);
        provider.destroy();
        persistence.destroy();
        document.destroy();
        role$.complete();
        state$.complete();
        participants$.complete();
      }
    };
  }
}
