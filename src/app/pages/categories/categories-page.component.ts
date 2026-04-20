import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToolStoreService } from '../../services/tool-store.service';

@Component({
  selector: 'app-categories-page',
  imports: [CommonModule],
  templateUrl: './categories-page.component.html',
  styleUrl: './categories-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoriesPageComponent {
  protected readonly store = inject(ToolStoreService);
}

