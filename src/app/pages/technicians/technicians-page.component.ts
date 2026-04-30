import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TechnicianFormModalComponent } from '../../components/technician-form-modal.component';
import { TechnicianStoreService } from '../../services/technician-store.service';

@Component({
  selector: 'app-technicians-page',
  imports: [CommonModule, TechnicianFormModalComponent],
  templateUrl: './technicians-page.component.html',
  styleUrl: './technicians-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TechniciansPageComponent {
  protected readonly technicianStore = inject(TechnicianStoreService);

  protected readonly technicians = computed(() => this.technicianStore.technicians());
  protected readonly totals = computed(() => ({
    total: this.technicianStore.technicians().length,
    active: this.technicianStore.activeTechnicians().length
  }));

  constructor() {
    this.technicianStore.ensureLoaded();
  }
}
