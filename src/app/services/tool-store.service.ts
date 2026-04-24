import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { demoTools } from '../data/demo-tools';
import { Tool, ToolFormSubmission, ToolListResponse } from '../models/tool.model';
import { ToolApiService } from './tool-api.service';
import { ConfirmService } from './confirm.service';
import { ToastService } from './toast.service';
import { BoardColumnKey } from '../components/tool-card.component';

export interface DashboardColumn {
  id: BoardColumnKey;
  title: string;
  accent: string;
  items: Tool[];
}

@Injectable({
  providedIn: 'root'
})
export class ToolStoreService {
  private readonly toolApi = inject(ToolApiService);
  private readonly toastService = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  readonly searchTerm = signal('');
  readonly tools = signal<Tool[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly modalOpen = signal(false);
  readonly editingTool = signal<Tool | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly useDemoData = signal(false);
  readonly bannerMessage = signal('Conectado a tu API de herramientas.');

  private initialized = false;

  readonly filteredTools = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();

    if (!search) {
      return this.tools();
    }

    return this.tools().filter((tool) => {
      const haystack = [
        tool.name,
        tool.type,
        tool.category,
        tool.description,
        tool.material,
        tool.state
      ].join(' ').toLowerCase();

      return haystack.includes(search);
    });
  });

  readonly stats = computed(() => {
    const tools = this.tools();

    return {
      total: tools.length,
      available: tools.filter((tool) => this.resolveColumn(tool.state) === 'available').length,
      active: tools.filter((tool) => this.resolveColumn(tool.state) === 'active').length,
      maintenance: tools.filter((tool) => this.resolveColumn(tool.state) === 'maintenance').length
    };
  });

  readonly columns = computed<DashboardColumn[]>(() => {
    const items = this.filteredTools();

    return [
      {
        id: 'available',
        title: 'Disponible',
        accent: '#4f9b43',
        items: items.filter((tool) => this.resolveColumn(tool.state) === 'available')
      },
      {
        id: 'active',
        title: 'En Uso',
        accent: '#eda43d',
        items: items.filter((tool) => this.resolveColumn(tool.state) === 'active')
      },
      {
        id: 'maintenance',
        title: 'En Mantenimiento',
        accent: '#f14e31',
        items: items.filter((tool) => this.resolveColumn(tool.state) === 'maintenance')
      }
    ];
  });

  readonly categories = computed(() => {
    const grouped = new Map<string, { total: number; available: number; materials: Set<string>; sample: Tool | null }>();

    for (const tool of this.filteredTools()) {
      const current = grouped.get(tool.category) ?? {
        total: 0,
        available: 0,
        materials: new Set<string>(),
        sample: null
      };

      current.total += 1;
      current.sample ??= tool;
      current.materials.add(tool.material);

      if (this.resolveColumn(tool.state) === 'available') {
        current.available += 1;
      }

      grouped.set(tool.category, current);
    }

    return Array.from(grouped.entries()).map(([name, value]) => ({
      name,
      total: value.total,
      available: value.available,
      maintenance: value.total - value.available,
      materials: Array.from(value.materials),
      sample: value.sample
    }));
  });

  readonly reportMetrics = computed(() => {
    const tools = this.filteredTools();
    const total = tools.length || 1;
    const available = tools.filter((tool) => this.resolveColumn(tool.state) === 'available').length;
    const active = tools.filter((tool) => this.resolveColumn(tool.state) === 'active').length;
    const maintenance = tools.filter((tool) => this.resolveColumn(tool.state) === 'maintenance').length;
    const averageLong = tools.length === 0
      ? 0
      : tools.reduce((accumulator, tool) => accumulator + tool.long, 0) / tools.length;

    return {
      totalTools: tools.length,
      availableRate: Math.round((available / total) * 100),
      activeRate: Math.round((active / total) * 100),
      maintenanceRate: Math.round((maintenance / total) * 100),
      averageLong: averageLong.toFixed(1),
      byType: this.groupByField(tools, 'type'),
      byMaterial: this.groupByField(tools, 'material')
    };
  });

  ensureLoaded(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.loadTools();
  }

  updateSearch(value: string): void {
    this.searchTerm.set(value);
  }

  openCreateModal(): void {
    this.saveError.set(null);
    this.editingTool.set(null);
    this.modalOpen.set(true);
  }

  openEditModal(tool: Tool): void {
    this.saveError.set(null);
    this.editingTool.set(tool);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.saveError.set(null);
    this.modalOpen.set(false);
    this.editingTool.set(null);
  }

  saveTool(submission: ToolFormSubmission): void {
    this.saveError.set(null);
    this.saving.set(true);

    if (this.useDemoData()) {
      this.applyDemoMutation(submission);
      return;
    }

    const currentEditing = this.editingTool();
    const request$ = submission.mode === 'edit' && currentEditing
      ? this.toolApi.updateTool(currentEditing.id, submission.payload)
      : this.toolApi.createTool(submission.payload);

    request$
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (tool) => {
          const nextTools = submission.mode === 'edit'
            ? this.replaceTool(this.tools(), tool)
            : [tool, ...this.tools()];

          this.saveError.set(null);
          this.tools.set(nextTools);
          this.bannerMessage.set('Herramienta sincronizada correctamente.');
          this.toastService.show({
            title: submission.mode === 'edit' ? 'Herramienta actualizada' : 'Herramienta creada',
            message: `${tool.name} se guardo correctamente.`,
            tone: 'success'
          });

          this.closeModal();

          if (submission.removeCurrentImage && submission.mode === 'edit') {
            this.executeDeleteImage(tool);
          }

          if (submission.file) {
            this.uploadImage(tool.id, submission.file);
          }
        },
        error: (error: unknown) => {
          const message = this.extractErrorMessage(error);
          this.saveError.set(message);
          this.bannerMessage.set(`No se pudo guardar: ${message}`);
          this.toastService.show({
            title: 'No se pudo guardar',
            message,
            tone: 'error'
          });
        }
      });
  }

  deleteTool(tool: Tool): void {
    this.confirmService.confirm({
      title: 'Eliminar herramienta',
      message: `¿Estás seguro de que deseas eliminar "${tool.name}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      tone: 'danger'
    }).then((confirmed) => {
      if (!confirmed) {
        return;
      }

      if (this.useDemoData()) {
        this.tools.set(this.tools().filter((t) => t.id !== tool.id));
        this.bannerMessage.set('Herramienta eliminada en modo demo.');
        this.toastService.show({
          title: 'Herramienta eliminada',
          message: `${tool.name} se elimino correctamente.`,
          tone: 'success'
        });
        return;
      }

      if (tool.urlSrc) {
        this.toolApi.deleteImage(tool.id).subscribe({
          next: () => {
            this.toastService.show({
              title: 'Imagen eliminada',
              message: `La imagen de ${tool.name} se elimino correctamente.`,
              tone: 'success'
            });
          },
          error: () => {
            this.bannerMessage.set('La herramienta se elimino, pero la imagen no se pudo borrar del storage.');
            this.toastService.show({
              title: 'Imagen no eliminada',
              message: `La herramienta ${tool.name} se elimino, pero su imagen no se pudo borrar del storage.`,
              tone: 'warning'
            });
          }
        });
      }

      this.toolApi.deleteTool(tool.id).subscribe({
        next: () => {
          this.tools.set(this.tools().filter((t) => t.id !== tool.id));
          this.bannerMessage.set('Herramienta eliminada correctamente.');
          this.toastService.show({
            title: 'Herramienta eliminada',
            message: `${tool.name} se elimino correctamente.`,
            tone: 'success'
          });
        },
        error: () => {
          this.bannerMessage.set('No se pudo eliminar la herramienta.');
          this.toastService.show({
            title: 'No se pudo eliminar',
            message: `Revisa la conexion con la API e intentalo de nuevo para eliminar ${tool.name}.`,
            tone: 'error'
          });
        }
      });


    });




  }

  async requestStateChange(tool: Tool, state: string): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: 'Cambiar estado',
      message: `Vas a mover "${tool.name}" al estado "${state}".`,
      confirmLabel: 'Actualizar estado'
    });

    if (!confirmed) {
      return;
    }

    if (this.useDemoData()) {
      this.tools.set(this.replaceTool(this.tools(), { ...tool, state }));
      this.bannerMessage.set(`Estado actualizado localmente a "${state}".`);
      this.toastService.show({
        title: 'Estado actualizado',
        message: `${tool.name} ahora figura como "${state}".`,
        tone: 'success'
      });
      return;
    }

    this.toolApi.updateState(tool.id, state).subscribe({
      next: (updatedTool) => {
        this.tools.set(this.replaceTool(this.tools(), updatedTool));
        this.bannerMessage.set(`Estado actualizado a "${state}".`);
        this.toastService.show({
          title: 'Estado actualizado',
          message: `${tool.name} ahora figura como "${state}".`,
          tone: 'success'
        });
      },
      error: () => {
        this.bannerMessage.set('No se pudo actualizar el estado.');
        this.toastService.show({
          title: 'No se pudo actualizar',
          message: `No fue posible cambiar el estado de ${tool.name}.`,
          tone: 'error'
        });
      }
    });
  }

  async requestDeleteImage(tool: Tool): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: 'Eliminar imagen',
      message: `Se eliminara la imagen asociada a "${tool.name}".`,
      confirmLabel: 'Eliminar imagen',
      tone: 'danger'
    });

    if (!confirmed) {
      return;
    }

    this.executeDeleteImage(tool);
  }

  getImage(tool: Tool): string {
    if (tool.urlSrc) {
      return tool.urlSrc;
    }

    const keyword = `${tool.name} ${tool.type} ${tool.category}`.toLowerCase();

    if (keyword.includes('taladro') || keyword.includes('perfor')) {
      return 'assets/tool-drill.svg';
    }

    if (keyword.includes('sierra') || keyword.includes('corte')) {
      return 'assets/tool-saw.svg';
    }

    if (keyword.includes('lijadora') || keyword.includes('acabado')) {
      return 'assets/tool-sander.svg';
    }

    if (keyword.includes('llave') || keyword.includes('ajuste')) {
      return 'assets/tool-wrench.svg';
    }

    if (keyword.includes('solda')) {
      return 'assets/tool-welder.svg';
    }

    return 'assets/tool-generic.svg';
  }

  private loadTools(): void {
    this.loading.set(true);

    this.toolApi.getTools()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          const items = this.extractItems(response);

          if (items.length === 0) {
            this.useDemoData.set(true);
            this.tools.set(demoTools);
            this.bannerMessage.set('La API no devuelve herramientas todavia. Mostrando tablero demo.');
            this.toastService.show({
              title: 'Modo demo',
              message: 'La API esta vacia. Se muestran herramientas de ejemplo.',
              tone: 'info'
            });
            return;
          }

          this.useDemoData.set(false);
          this.tools.set(items);
          this.bannerMessage.set('Conectado a tu API de herramientas.');
        },
        error: () => {
          this.useDemoData.set(true);
          this.tools.set(demoTools);
          this.bannerMessage.set('No se pudo conectar con la API. Mostrando tablero demo.');
          this.toastService.show({
            title: 'Sin conexion',
            message: 'No hubo respuesta de la API. Se muestra la vista demo.',
            tone: 'warning'
          });
        }
      });
  }

  private extractItems(response: Tool[] | ToolListResponse): Tool[] {
    return Array.isArray(response) ? response : response.items;
  }

  private resolveColumn(state: string): BoardColumnKey {
    const normalized = state.toLowerCase();

    if (normalized.includes('mant') || normalized.includes('repar')) {
      return 'maintenance';
    }

    if (normalized.includes('uso') || normalized.includes('prest') || normalized.includes('obra')) {
      return 'active';
    }

    return 'available';
  }

  private replaceTool(list: Tool[], updated: Tool): Tool[] {
    return list.map((tool) => (tool.id === updated.id ? updated : tool));
  }

  private uploadImage(id: string, file: File): void {
    this.toolApi.uploadImage(id, file).subscribe({
      next: (response) => {
        this.tools.set(this.replaceTool(this.tools(), response.tool));
        this.bannerMessage.set('Imagen subida a Firebase Storage.');
        this.toastService.show({
          title: 'Imagen actualizada',
          message: 'La nueva imagen se subio correctamente.',
          tone: 'success'
        });
      },
      error: () => {
        this.bannerMessage.set('La herramienta se guardo, pero la imagen no se pudo subir.');
        this.toastService.show({
          title: 'Imagen no subida',
          message: 'La herramienta se guardo, pero la subida de la imagen fallo.',
          tone: 'warning'
        });
      }
    });
  }

  private executeDeleteImage(tool: Tool): void {
    if (this.useDemoData()) {
      this.tools.set(this.replaceTool(this.tools(), { ...tool, urlSrc: '' }));
      this.bannerMessage.set('Imagen eliminada en modo demo.');
      this.toastService.show({
        title: 'Imagen eliminada',
        message: `La imagen de ${tool.name} se elimino correctamente.`,
        tone: 'success'
      });
      return;
    }

    this.toolApi.deleteImage(tool.id).subscribe({
      next: (response) => {
        this.tools.set(this.replaceTool(this.tools(), response.tool));
        this.bannerMessage.set('Imagen eliminada correctamente.');
        this.toastService.show({
          title: 'Imagen eliminada',
          message: `La imagen de ${tool.name} se elimino correctamente.`,
          tone: 'success'
        });
      },
      error: () => {
        this.bannerMessage.set('No se pudo eliminar la imagen.');
        this.toastService.show({
          title: 'No se pudo eliminar',
          message: `La imagen de ${tool.name} no se pudo borrar.`,
          tone: 'error'
        });
      }
    });
  }

  private applyDemoMutation(submission: ToolFormSubmission): void {
    const currentEditing = this.editingTool();
    const previewUrl = submission.file ? URL.createObjectURL(submission.file) : submission.payload.urlSrc;
    const tool: Tool = {
      id: currentEditing?.id ?? `demo-${crypto.randomUUID()}`,
      ...submission.payload,
      urlSrc: submission.removeCurrentImage ? '' : previewUrl
    };

    if (submission.mode === 'edit' && currentEditing) {
      this.tools.set(this.replaceTool(this.tools(), tool));
      this.bannerMessage.set('Cambios aplicados en modo demo.');
      this.toastService.show({
        title: 'Cambios guardados',
        message: `${tool.name} se actualizo en modo demo.`,
        tone: 'success'
      });
    } else {
      this.tools.set([tool, ...this.tools()]);
      this.bannerMessage.set('Nueva herramienta creada en modo demo.');
      this.toastService.show({
        title: 'Herramienta creada',
        message: `${tool.name} se agrego en modo demo.`,
        tone: 'success'
      });
    }

    this.saving.set(false);
    this.closeModal();
  }

  private groupByField(tools: Tool[], key: 'type' | 'material'): Array<{ label: string; total: number; ratio: number }> {
    const counts = new Map<string, number>();

    for (const tool of tools) {
      counts.set(tool[key], (counts.get(tool[key]) ?? 0) + 1);
    }

    const total = tools.length || 1;

    return Array.from(counts.entries())
      .map(([label, amount]) => ({
        label,
        total: amount,
        ratio: Math.round((amount / total) * 100)
      }))
      .sort((left, right) => right.total - left.total);
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const payload = error.error as
        | string
        | { message?: string; error?: string; errors?: string[] | Record<string, string | string[]> }
        | null;

      if (typeof payload === 'string' && payload.trim()) {
        return payload.trim();
      }

      if (payload && typeof payload === 'object') {
        if (typeof payload.message === 'string' && payload.message.trim()) {
          return payload.message.trim();
        }

        if (typeof payload.error === 'string' && payload.error.trim()) {
          return payload.error.trim();
        }

        if (Array.isArray(payload.errors) && payload.errors.length > 0) {
          return payload.errors.join(' ');
        }

        if (payload.errors && typeof payload.errors === 'object') {
          const messages = Object.values(payload.errors)
            .flatMap((value) => Array.isArray(value) ? value : [value])
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

          if (messages.length > 0) {
            return messages.join(' ');
          }
        }
      }

      if (typeof error.message === 'string' && error.message.trim()) {
        return error.message.trim();
      }
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }

    return 'Revisa los datos enviados e intentalo de nuevo.';
  }
}
