import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Tool } from '../../models/tool.model';
import { ToolStoreService } from '../../services/tool-store.service';

@Component({
  selector: 'app-categories-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './categories-page.component.html',
  styleUrl: './categories-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoriesPageComponent {
  protected readonly store = inject(ToolStoreService);
  protected readonly collapsedCategories = signal<Record<string, boolean>>({});
  protected readonly sortField = signal<'name' | 'state' | 'brand'>('name');
  protected readonly sortOrder = signal<'asc' | 'desc'>('asc');

  protected readonly categories = computed(() => {
    const grouped = new Map<string, Tool[]>();

    for (const tool of this.store.filteredTools()) {
      const current = grouped.get(tool.category) ?? [];
      current.push(tool);
      grouped.set(tool.category, current);
    }

    return Array.from(grouped.entries())
      .map(([name, tools]) => ({
        name,
        tools: [...tools].sort((left, right) => this.compareTools(left, right)),
        total: tools.length
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  });

  protected getStateTone(state: string): 'available' | 'active' | 'maintenance' {
    const normalized = state.trim().toLowerCase();

    if (normalized.includes('mant') || normalized.includes('repar')) {
      return 'maintenance';
    }

    if (normalized.includes('uso') || normalized.includes('prest') || normalized.includes('obra')) {
      return 'active';
    }

    return 'available';
  }

  protected toggleCategory(name: string): void {
    this.collapsedCategories.update((state) => ({
      ...state,
      [name]: !state[name]
    }));
  }

  protected isExpanded(name: string): boolean {
    return !this.collapsedCategories()[name];
  }

  private compareTools(left: Tool, right: Tool): number {
    const direction = this.sortOrder() === 'asc' ? 1 : -1;
    const field = this.sortField();

    if (field === 'state') {
      const result = this.getStateRank(left.state) - this.getStateRank(right.state);
      return result === 0 ? left.name.localeCompare(right.name) * direction : result * direction;
    }

    const leftValue = field === 'brand' ? (left.brand || 'zzzz') : left.name;
    const rightValue = field === 'brand' ? (right.brand || 'zzzz') : right.name;

    return leftValue.localeCompare(rightValue) * direction;
  }

  private getStateRank(state: string): number {
    const tone = this.getStateTone(state);

    if (tone === 'active') {
      return 1;
    }

    if (tone === 'maintenance') {
      return 2;
    }

    return 0;
  }
}
