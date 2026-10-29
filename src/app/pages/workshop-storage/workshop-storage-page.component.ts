import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  WorkshopCompartment,
  WorkshopCompartmentPayload,
  WorkshopLevel,
  WorkshopLevelPayload,
  WorkshopMaterial,
  WorkshopMaterialPayload,
  WorkshopMaterialSearchResult,
  WorkshopOrganizer,
  WorkshopOrganizerPayload,
  WorkshopShelf,
  WorkshopShelfPayload,
  WorkshopStorageSnapshot
} from '../../models/workshop-storage.model';
import { ConfirmService } from '../../services/confirm.service';
import { WorkshopStorageApiService } from '../../services/workshop-storage-api.service';

type EntityType = 'shelf' | 'level' | 'organizer' | 'compartment' | 'material';

interface WorkshopStorageDraft {
  name: string;
  description: string;
  position: number;
  width: number | null;
  depth: number | null;
  shelfId: string;
  levelId: string;
  type: string;
  columns: number;
  organizerId: string;
  row: number;
  column: number;
  size: string;
  compartmentId: string;
  category: string;
  reference: string;
  diameter: number | null;
  length: number | null;
  innerDiameter: number | null;
  outerDiameter: number | null;
  material: string;
  headType: string;
  threadType: string;
  quantity: number | null;
  imageUrl: string;
  notes: string;
}

function createEmptySnapshot(): WorkshopStorageSnapshot {
  return { shelves: [], levels: [], organizers: [], compartments: [], materials: [] };
}

function createEmptyDraft(): WorkshopStorageDraft {
  return {
    name: '',
    description: '',
    position: 1,
    width: null,
    depth: null,
    shelfId: '',
    levelId: '',
    type: 'compact',
    columns: 3,
    organizerId: '',
    row: 1,
    column: 1,
    size: '',
    compartmentId: '',
    category: 'Tornillos',
    reference: '',
    diameter: null,
    length: null,
    innerDiameter: null,
    outerDiameter: null,
    material: '',
    headType: '',
    threadType: '',
    quantity: null,
    imageUrl: '',
    notes: ''
  };
}

@Component({
  selector: 'app-workshop-storage-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './workshop-storage-page.component.html',
  styleUrl: './workshop-storage-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkshopStoragePageComponent {
  private readonly api = inject(WorkshopStorageApiService);
  private readonly confirmService = inject(ConfirmService);

  protected readonly data = signal(createEmptySnapshot());
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly saveError = signal('');
  protected readonly searchQuery = signal('');
  protected readonly searchResults = signal<WorkshopMaterialSearchResult[]>([]);
  protected readonly searchLoading = signal(false);
  protected readonly searchComplete = signal(false);
  protected readonly activeShelfId = signal('');
  protected readonly selectedOrganizerId = signal('');
  protected readonly selectedCompartmentId = signal('');
  protected readonly selectedMaterialId = signal('');
  protected readonly dialogType = signal<EntityType | null>(null);
  protected readonly editingId = signal('');
  protected readonly draft = createEmptyDraft();
  protected readonly imageFile = signal<File | null>(null);

  protected readonly activeShelf = computed(() =>
    this.data().shelves.find((shelf) => shelf.id === this.activeShelfId()) ?? null
  );
  protected readonly selectedOrganizer = computed(() =>
    this.data().organizers.find((organizer) => organizer.id === this.selectedOrganizerId()) ?? null
  );
  protected readonly selectedCompartment = computed(() =>
    this.data().compartments.find((compartment) => compartment.id === this.selectedCompartmentId()) ?? null
  );
  protected readonly selectedMaterial = computed(() =>
    this.data().materials.find((material) => material.id === this.selectedMaterialId()) ?? null
  );
  protected readonly organizerLevel = computed(() => {
    const organizer = this.selectedOrganizer();
    return organizer ? this.data().levels.find((level) => level.id === organizer.levelId) ?? null : null;
  });
  protected readonly organizerShelf = computed(() => {
    const level = this.organizerLevel();
    return level ? this.data().shelves.find((shelf) => shelf.id === level.shelfId) ?? null : null;
  });
  protected readonly occupiedCompartments = computed(() => {
    const data = this.data();
    return data.compartments.filter((compartment) =>
      data.materials.some((material) => material.compartmentId === compartment.id)
    ).length;
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const snapshot = await firstValueFrom(this.api.load());
      const normalized = {
        shelves: [...(snapshot.shelves ?? [])].sort((a, b) => a.position - b.position),
        levels: snapshot.levels ?? [],
        organizers: snapshot.organizers ?? [],
        compartments: snapshot.compartments ?? [],
        materials: snapshot.materials ?? []
      };
      this.data.set(normalized);

      if (!normalized.shelves.some((shelf) => shelf.id === this.activeShelfId())) {
        this.activeShelfId.set(normalized.shelves[0]?.id ?? '');
      }
      if (!normalized.organizers.some((organizer) => organizer.id === this.selectedOrganizerId())) {
        this.selectedOrganizerId.set('');
        this.selectedCompartmentId.set('');
      }
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error, 'No se pudo cargar la configuración del almacenamiento.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected levelsForShelf(shelfId: string): WorkshopLevel[] {
    return this.data().levels
      .filter((level) => level.shelfId === shelfId)
      .sort((a, b) => a.position - b.position);
  }

  protected organizersForLevel(levelId: string): WorkshopOrganizer[] {
    return this.data().organizers
      .filter((organizer) => organizer.levelId === levelId)
      .sort((a, b) => a.position - b.position);
  }

  protected compartmentsForOrganizer(organizerId: string): WorkshopCompartment[] {
    return this.data().compartments
      .filter((compartment) => compartment.organizerId === organizerId)
      .sort((a, b) => a.position - b.position);
  }

  protected materialsForCompartment(compartmentId: string): WorkshopMaterial[] {
    return this.data().materials.filter((material) => material.compartmentId === compartmentId);
  }

  protected hasMaterials(organizerId: string): boolean {
    return this.compartmentsForOrganizer(organizerId)
      .some((compartment) => this.materialsForCompartment(compartment.id).length > 0);
  }

  protected shelfNameForLevel(levelId: string): string {
    const level = this.data().levels.find((item) => item.id === levelId);
    return this.data().shelves.find((shelf) => shelf.id === level?.shelfId)?.name ?? '';
  }

  protected selectShelf(shelf: WorkshopShelf): void {
    this.activeShelfId.set(shelf.id);
    const currentOrganizer = this.selectedOrganizer();
    const currentLevel = currentOrganizer
      ? this.data().levels.find((level) => level.id === currentOrganizer.levelId)
      : null;
    if (!currentLevel || currentLevel.shelfId !== shelf.id) {
      this.selectedOrganizerId.set('');
      this.selectedCompartmentId.set('');
      this.selectedMaterialId.set('');
    }
  }

  protected selectOrganizer(organizer: WorkshopOrganizer): void {
    this.selectedOrganizerId.set(organizer.id);
    this.selectedCompartmentId.set('');
    this.selectedMaterialId.set('');
    const level = this.data().levels.find((item) => item.id === organizer.levelId);
    if (level) this.activeShelfId.set(level.shelfId);
  }

  protected selectCompartment(compartment: WorkshopCompartment): void {
    this.selectedCompartmentId.set(compartment.id);
    this.selectedMaterialId.set('');
  }

  protected selectSearchResult(result: WorkshopMaterialSearchResult): void {
    this.activeShelfId.set(result.shelf.id);
    this.selectedOrganizerId.set(result.organizer.id);
    this.selectedCompartmentId.set(result.compartment.id);
    this.selectedMaterialId.set(result.material.id);
  }

  protected isOrganizerHighlighted(organizerId: string): boolean {
    return this.searchResults().some((result) => result.organizer.id === organizerId);
  }

  protected isCompartmentHighlighted(compartmentId: string): boolean {
    return this.searchResults().some((result) => result.compartment.id === compartmentId);
  }

  protected async search(): Promise<void> {
    const query = this.searchQuery().trim();
    this.searchResults.set([]);
    this.searchComplete.set(false);
    this.error.set('');
    if (!query) return;

    this.searchLoading.set(true);
    try {
      const results = await firstValueFrom(this.api.search(query));
      this.searchResults.set(results);
      this.searchComplete.set(true);
      if (results.length) this.selectSearchResult(results[0]);
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error, 'No se pudo buscar el material.'));
    } finally {
      this.searchLoading.set(false);
    }
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.searchComplete.set(false);
  }

  protected updateSearchQuery(query: string): void {
    this.searchQuery.set(query);
    this.searchComplete.set(false);
    this.searchResults.set([]);
  }

  protected openCreate(type: EntityType, parentId = ''): void {
    this.editingId.set('');
    this.saveError.set('');
    this.imageFile.set(null);
    Object.assign(this.draft, createEmptyDraft());

    if (type === 'shelf') this.draft.position = this.data().shelves.length + 1;
    if (type === 'level') {
      this.draft.shelfId = parentId || this.activeShelfId();
      this.draft.position = this.levelsForShelf(this.draft.shelfId).length + 1;
    }
    if (type === 'organizer') {
      this.draft.levelId = parentId;
      this.draft.position = this.organizersForLevel(parentId).length + 1;
    }
    if (type === 'compartment') {
      this.draft.organizerId = parentId || this.selectedOrganizerId();
      const organizer = this.data().organizers.find((item) => item.id === this.draft.organizerId);
      const compartments = this.compartmentsForOrganizer(this.draft.organizerId);
      const count = compartments.length;
      const columns = Math.max(1, organizer?.columns ?? 1);
      this.draft.position = count + 1;
      this.draft.column = (count % columns) + 1;
      this.draft.row = Math.floor(count / columns) + 1;
    }
    if (type === 'material') this.draft.compartmentId = parentId || this.selectedCompartmentId();

    this.dialogType.set(type);
  }

  protected openEdit(type: EntityType, entity: WorkshopShelf | WorkshopLevel | WorkshopOrganizer | WorkshopCompartment | WorkshopMaterial): void {
    this.openCreate(type);
    this.editingId.set(entity.id);

    switch (type) {
      case 'shelf':
        Object.assign(this.draft, entity as WorkshopShelf);
        break;
      case 'level':
        Object.assign(this.draft, entity as WorkshopLevel);
        break;
      case 'organizer':
        Object.assign(this.draft, entity as WorkshopOrganizer);
        break;
      case 'compartment':
        Object.assign(this.draft, entity as WorkshopCompartment);
        break;
      case 'material':
        Object.assign(this.draft, entity as WorkshopMaterial);
        break;
    }
  }

  protected closeDialog(): void {
    if (this.saving()) return;
    this.dialogType.set(null);
    this.saveError.set('');
    this.imageFile.set(null);
  }

  protected onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.imageFile.set(input.files?.[0] ?? null);
  }

  protected async saveDraft(): Promise<void> {
    const type = this.dialogType();
    if (!type || !this.draft.name.trim()) {
      this.saveError.set('El nombre es obligatorio.');
      return;
    }

    this.saving.set(true);
    this.saveError.set('');
    let materialId = '';
    let savedEntityId = '';

    try {
      switch (type) {
        case 'shelf': {
          const payload: WorkshopShelfPayload = {
            name: this.draft.name.trim(),
            description: this.draft.description.trim(),
            position: this.draft.position
          };
          const saved = this.editingId()
            ? await firstValueFrom(this.api.updateShelf(this.editingId(), payload))
            : await firstValueFrom(this.api.createShelf(payload));
          savedEntityId = saved.id;
          this.activeShelfId.set(saved.id);
          break;
        }
        case 'level': {
          const payload: WorkshopLevelPayload = {
            shelfId: this.draft.shelfId,
            name: this.draft.name.trim(),
            position: this.draft.position,
            width: this.draft.width,
            depth: this.draft.depth
          };
          const saved = this.editingId()
            ? await firstValueFrom(this.api.updateLevel(this.editingId(), payload))
            : await firstValueFrom(this.api.createLevel(payload));
          savedEntityId = saved.id;
          this.activeShelfId.set(payload.shelfId);
          break;
        }
        case 'organizer': {
          const payload: WorkshopOrganizerPayload = {
            levelId: this.draft.levelId,
            name: this.draft.name.trim(),
            type: this.draft.type.trim() || 'compact',
            position: this.draft.position,
            columns: Math.max(1, Math.floor(this.draft.columns)),
            width: this.draft.width,
            depth: this.draft.depth,
            description: this.draft.description.trim()
          };
          const saved = this.editingId()
            ? await firstValueFrom(this.api.updateOrganizer(this.editingId(), payload))
            : await firstValueFrom(this.api.createOrganizer(payload));
          savedEntityId = saved.id;
          this.selectedOrganizerId.set(saved.id);
          this.selectedCompartmentId.set('');
          this.activeShelfId.set(this.data().levels.find((level) => level.id === payload.levelId)?.shelfId ?? '');
          break;
        }
        case 'compartment': {
          const payload: WorkshopCompartmentPayload = {
            organizerId: this.draft.organizerId,
            name: this.draft.name.trim(),
            position: this.draft.position,
            row: Math.max(1, Math.floor(this.draft.row)),
            column: Math.max(1, Math.floor(this.draft.column)),
            size: this.draft.size.trim()
          };
          const saved = this.editingId()
            ? await firstValueFrom(this.api.updateCompartment(this.editingId(), payload))
            : await firstValueFrom(this.api.createCompartment(payload));
          savedEntityId = saved.id;
          this.selectedOrganizerId.set(payload.organizerId);
          this.selectedCompartmentId.set(saved.id);
          break;
        }
        case 'material': {
          const payload: WorkshopMaterialPayload = {
            compartmentId: this.draft.compartmentId,
            name: this.draft.name.trim(),
            category: this.draft.category.trim(),
            reference: this.draft.reference.trim(),
            diameter: this.draft.diameter,
            length: this.draft.length,
            innerDiameter: this.draft.innerDiameter,
            outerDiameter: this.draft.outerDiameter,
            material: this.draft.material.trim(),
            headType: this.draft.headType.trim(),
            threadType: this.draft.threadType.trim(),
            quantity: this.draft.quantity,
            imageUrl: this.draft.imageUrl,
            notes: this.draft.notes.trim()
          };
          const saved = this.editingId()
            ? await firstValueFrom(this.api.updateMaterial(this.editingId(), payload))
            : await firstValueFrom(this.api.createMaterial(payload));
          materialId = saved.id;
          savedEntityId = saved.id;
          this.editingId.set(saved.id);
          this.selectedMaterialId.set(saved.id);
          this.selectedCompartmentId.set(payload.compartmentId);
          const compartment = this.data().compartments.find((item) => item.id === payload.compartmentId);
          this.selectedOrganizerId.set(compartment?.organizerId ?? '');
          break;
        }
      }

      if (type === 'material' && materialId && this.imageFile()) {
        const image = this.imageFile();
        if (image) await firstValueFrom(this.api.uploadMaterialImage(materialId, image));
      }

      if (type === 'shelf') this.activeShelfId.set(savedEntityId);
      this.dialogType.set(null);
      this.imageFile.set(null);
      await this.load();
    } catch (error: unknown) {
      this.saveError.set(this.errorMessage(error, 'No se pudo guardar el cambio.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(type: EntityType, id: string): Promise<void> {
    const entityName = this.entityName(type, id);
    const confirmed = await this.confirmService.confirm({
      title: `¿Eliminar ${this.entityLabel(type)}?`,
      message: `Vas a eliminar «${entityName}». Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      cancelLabel: 'Rectificar',
      tone: 'danger'
    });
    if (!confirmed) return;

    try {
      switch (type) {
        case 'shelf': await firstValueFrom(this.api.deleteShelf(id)); break;
        case 'level': await firstValueFrom(this.api.deleteLevel(id)); break;
        case 'organizer': await firstValueFrom(this.api.deleteOrganizer(id)); break;
        case 'compartment': await firstValueFrom(this.api.deleteCompartment(id)); break;
        case 'material': await firstValueFrom(this.api.deleteMaterial(id)); break;
      }
      if (type === 'organizer') this.selectedOrganizerId.set('');
      if (type === 'compartment') this.selectedCompartmentId.set('');
      if (type === 'material') this.selectedMaterialId.set('');
      await this.load();
    } catch (error: unknown) {
      this.error.set(this.errorMessage(error, 'No se pudo eliminar. Comprueba que no contiene elementos asociados.'));
    }
  }

  private entityName(type: EntityType, id: string): string {
    const collections = {
      shelf: this.data().shelves,
      level: this.data().levels,
      organizer: this.data().organizers,
      compartment: this.data().compartments,
      material: this.data().materials
    };

    return collections[type].find((entity) => entity.id === id)?.name ?? this.entityLabel(type);
  }

  private entityLabel(type: EntityType): string {
    const labels: Record<EntityType, string> = {
      shelf: 'estantería',
      level: 'balda',
      organizer: 'organizador',
      compartment: 'compartimento',
      material: 'material'
    };
    return labels[type];
  }

  protected titleForDialog(): string {
    const type = this.dialogType();
    const label: Record<EntityType, string> = {
      shelf: 'estantería',
      level: 'balda',
      organizer: 'organizador',
      compartment: 'compartimento',
      material: 'material'
    };
    return `${this.editingId() ? 'Editar' : 'Añadir'} ${type ? label[type] : ''}`;
  }

  protected usesWasherSpecs(): boolean {
    return this.draft.category.toLocaleLowerCase('es').includes('arandela');
  }

  protected usesScrewSpecs(): boolean {
    const category = this.draft.category.toLocaleLowerCase('es');
    return category.includes('tornill') || category.includes('taco') || category.includes('tuerca');
  }

  protected usesLengthSpec(): boolean {
    const category = this.draft.category.toLocaleLowerCase('es');
    return category.includes('tornill') || category.includes('taco');
  }

  protected usesGenericSpecs(): boolean {
    return !this.usesWasherSpecs() && !this.usesScrewSpecs();
  }

  protected formatLocation(result: WorkshopMaterialSearchResult): string {
    return `${result.shelf.name} → ${result.level.name} → ${result.organizer.name} → ${result.compartment.name}`;
  }

  protected formatMaterialCharacteristics(material: WorkshopMaterial): string {
    return [
      material.reference,
      material.diameter != null ? `Ø ${material.diameter} mm` : '',
      material.length != null ? `${material.length} mm` : '',
      material.innerDiameter != null ? `interior ${material.innerDiameter} mm` : '',
      material.outerDiameter != null ? `exterior ${material.outerDiameter} mm` : '',
      material.material,
      material.headType,
      material.threadType,
      material.quantity != null ? `${material.quantity} uds.` : ''
    ].filter(Boolean).join(' · ');
  }

  protected organizerTypeLabel(type: string): string {
    return type === 'large' ? 'Grande' : type === 'compact' ? 'Compacto' : type;
  }

  private errorMessage(error: unknown, fallback: string): string {
    const response = error as { error?: { message?: string }; message?: string };
    return response.error?.message || response.message || fallback;
  }
}
