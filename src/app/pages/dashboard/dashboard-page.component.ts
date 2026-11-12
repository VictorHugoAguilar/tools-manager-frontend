import {
  ChangeDetectionStrategy,
  Component,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToolCardComponent } from '../../components/tool-card.component';
import { ToolStoreService } from '../../services/tool-store.service';
import { ToolTracingComponent } from '../../components/tool-tracing.component';

@Component({
  selector: 'app-dashboard-page',
  imports: [CommonModule, ToolCardComponent, ToolTracingComponent],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent {
  protected readonly store = inject(ToolStoreService);
}
