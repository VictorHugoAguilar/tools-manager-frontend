import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Tool } from '../models/tool.model';
import { DropdownMenuComponent } from '../components/app-dropdown-menu/dropdown-menu.component';
import { StateColorPipe } from "../pipe/state-color-pipe";

export type BoardColumnKey = 'available' | 'active' | 'maintenance';

@Component({
  selector: 'app-tool-card',
  imports: [CommonModule, DropdownMenuComponent, StateColorPipe],
  templateUrl: './tool-card.component.html',
  styleUrl: './tool-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolCardComponent {
  [x: string]: any;
  readonly tool = input.required<Tool>();
  readonly column = input.required<BoardColumnKey>();
  readonly imageUrl = input.required<string>();

  readonly edit = output<void>();
  readonly delete = output<void>();
  readonly changeState = output<string>();
  readonly deleteImage = output<void>();

  readonly menuItems = [
    { label: 'Editar', value: 'edit' },
    { label: 'Eliminar', value: 'delete' },
  ];

  protected readonly detailRows = computed(() => {
    const tool = this.tool();

    return [
      { label: 'Marca', value: tool.brand },
      { label: 'Modelo', value: tool.model },
      { label: 'Tipo', value: tool.type },
      { label: 'Material', value: tool.material },
      { label: 'Longitud', value: `${tool.long} cm` }
    ];
  });

  protected readonly secondaryBadge = computed(() => {
    const tool = this.tool();

    if (this.column() === 'maintenance') {
      return 'Pendiente';
    }

    return tool.category;
  });

  protected readonly footerActions = computed(() => {
    switch (this.column()) {
      case 'available':
        return [
          { label: 'Editar', kind: 'edit' },
          { label: 'Asignar', kind: 'state', nextState: 'En Uso' },
          { label: 'Mantenimiento', kind: 'state', nextState: 'Mantenimiento' }
        ] as const;
      case 'active':
        return [
          { label: 'Editar', kind: 'edit' },
          { label: 'Devolver', kind: 'state', nextState: 'Disponible' },
          { label: 'Mantenimiento', kind: 'state', nextState: 'Mantenimiento' }
        ] as const;
      default:
        return [
          { label: 'Editar', kind: 'edit' },
          { label: 'Historial', kind: 'edit' },
          { label: 'Disponible', kind: 'state', nextState: 'Disponible' }
        ] as const;
    }
  });

  protected triggerAction(
    action: (typeof this.footerActions extends never ? never : never) | {
      label: string;
      kind: 'edit' | 'state';
      nextState?: string;
    }
  ): void {
    if (action.kind === 'edit') {
      this.edit.emit();
      return;
    }

    if (action.nextState) {
      this.changeState.emit(action.nextState);
    }
  }

  protected expanded = signal(false);

  protected changeLongDescription = (() => {
    this.expanded.update(expanded => !expanded);
  });


  protected onAction(action: string) {
    if (action === 'edit') {
      this.edit.emit();
    }

    if (action === 'delete') {
      this.delete.emit();
    }
  }
}

