import { ChangeDetectionStrategy, Component, computed, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Tool } from '../../models/tool.model';
import { ToolStoreService } from '../../services/tool-store.service';

@Component({
  selector: 'app-inventory-page',
  imports: [CommonModule],
  templateUrl: './inventory-page.component.html',
  styleUrl: './inventory-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryPageComponent {
  protected readonly store = inject(ToolStoreService);
  protected readonly openStateMenuId = signal<string | null>(null);
  protected readonly stateOptions = ['Disponible', 'En Uso', 'En Mantenimiento'] as const;

  protected readonly rows = computed(() => this.store.filteredTools());

  @HostListener('document:click')
  protected closeStateMenu(): void {
    this.openStateMenuId.set(null);
  }

  protected toggleStateMenu(toolId: string, event: Event): void {
    event.stopPropagation();
    this.openStateMenuId.set(this.openStateMenuId() === toolId ? null : toolId);
  }

  protected async changeState(tool: Tool, state: string, event: Event): Promise<void> {
    event.stopPropagation();
    this.openStateMenuId.set(null);
    await this.store.requestStateChange(tool, state);
  }

  protected isCurrentState(tool: Tool, state: string): boolean {
    return this.normalizeState(tool.state) === this.normalizeState(state);
  }

  protected getStateTone(state: string): 'available' | 'active' | 'maintenance' {
    const normalized = this.normalizeState(state);

    if (normalized === 'uso') {
      return 'active';
    }

    if (normalized === 'mantenimiento') {
      return 'maintenance';
    }

    return 'available';
  }

  private normalizeState(state: string): string {
    const normalized = state.trim().toLowerCase();

    if (normalized.includes('mant') || normalized.includes('repar')) {
      return 'mantenimiento';
    }

    if (normalized.includes('uso') || normalized.includes('prest') || normalized.includes('obra')) {
      return 'uso';
    }

    return 'disponible';
  }
}
