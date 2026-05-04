import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ToolFormModalComponent } from './tool-form-modal.component';
import { ToolStoreService } from '../services/tool-store.service';
import { PropertiesStorageService } from '../services/properties-storage.service';
import packageInfo from '../../../package.json';

interface ShellRouteData {
  eyebrow: string;
  title: string;
  description: string;
  showCreateAction: boolean;
}

@Component({
  selector: 'app-shell',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ToolFormModalComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent {
  protected readonly store = inject(ToolStoreService);
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly propertiesStorage = inject(PropertiesStorageService);

  protected readonly sidebarOpen = signal(this.getInitialSidebarState());
  protected readonly appVersion = packageInfo.version;

  protected readonly showTecnicos = signal(this.getShowTecnicosInitialValue());
  protected readonly showArreglos = signal(this.getShowArreglosInitialValue());

  private getShowTecnicosInitialValue(): boolean { 
    return this.propertiesStorage.getValueOfLocalStorageByKey('show-access-to-technicians-menu');
  }

  private getShowArreglosInitialValue(): boolean {
    return this.propertiesStorage.getValueOfLocalStorageByKey('show-access-to-arrangements-menu');
  }

  private readonly routeData = signal<ShellRouteData>({
    eyebrow: 'Panel Operativo',
    title: 'Tablero de Herramientas',
    description: 'Gestion centralizada de disponibilidad, uso y mantenimiento.',
    showCreateAction: true
  });

  protected readonly showCreateAction = computed(() => this.routeData().showCreateAction);

  constructor() {
    this.store.ensureLoaded();
    this.syncRouteData();

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.syncRouteData();
      });
  }

  protected get currentRoute(): ShellRouteData {
    return this.routeData();
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((current) => {
      const next = !current;
      this.propertiesStorage.setValueOfLocalStorageByKey('tool-frontend-sidebar-open', next);
      return next;
    });

    this.showTecnicos.update((current) => {
      const next = this.getShowTecnicosInitialValue();
      return next;
    });

    this.showArreglos.update((current) => {
      const next = this.getShowArreglosInitialValue();
      return next;
    });

  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
    this.propertiesStorage.setValueOfLocalStorageByKey('tool-frontend-sidebar-open', false);
  }

  private syncRouteData(): void {
    let route = this.activatedRoute.firstChild;

    while (route?.firstChild) {
      route = route.firstChild;
    }

    const data = route?.snapshot?.data as Partial<ShellRouteData> | undefined;

    this.routeData.set({
      eyebrow: data?.eyebrow ?? 'Panel Operativo',
      title: data?.title ?? 'Gestion de Herramientas',
      description: data?.description ?? 'Operacion diaria de herramientas.',
      showCreateAction: data?.showCreateAction ?? true
    });
  }

  private getInitialSidebarState(): boolean {
    return this.propertiesStorage.getValueOfLocalStorageByKey('tool-frontend-sidebar-open');
  }
}
