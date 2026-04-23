import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ToolFormModalComponent } from './tool-form-modal.component';
import { ToolStoreService } from '../services/tool-store.service';

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
  protected readonly sidebarOpen = signal(this.getInitialSidebarState());

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
      localStorage.setItem('tool-frontend-sidebar-open', String(next));
      return next;
    });
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
    localStorage.setItem('tool-frontend-sidebar-open', 'false');
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
    if (typeof localStorage === 'undefined') {
      return true;
    }

    const storedValue = localStorage.getItem('tool-frontend-sidebar-open');

    if (storedValue === null) {
      return true;
    }

    return storedValue === 'true';
  }
}
