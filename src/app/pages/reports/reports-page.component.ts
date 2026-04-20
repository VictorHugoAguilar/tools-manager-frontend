import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToolStoreService } from '../../services/tool-store.service';

@Component({
  selector: 'app-reports-page',
  imports: [CommonModule],
  templateUrl: './reports-page.component.html',
  styleUrl: './reports-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsPageComponent {
  protected readonly store = inject(ToolStoreService);
}

