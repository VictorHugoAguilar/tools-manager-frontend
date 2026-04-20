import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
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

  protected readonly rows = computed(() => this.store.filteredTools());
}

