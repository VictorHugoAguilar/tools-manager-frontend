import { Routes } from '@angular/router';
import { AppShellComponent } from './components/app-shell.component';
import { DashboardPageComponent } from './pages/dashboard/dashboard-page.component';
import { InventoryPageComponent } from './pages/inventory/inventory-page.component';
import { CategoriesPageComponent } from './pages/categories/categories-page.component';
import { ReportsPageComponent } from './pages/reports/reports-page.component';
import { RepairsPageComponent } from './pages/repairs/repairs-page.component';
import { SettingsPageComponent } from './pages/settings/settings-page.component';
import { TechniciansPageComponent } from './pages/technicians/technicians-page.component';

export const appRoutes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'tablero'
      },
      {
        path: 'tablero',
        component: DashboardPageComponent,
        data: {
          eyebrow: 'Panel Operativo',
          title: 'Tablero de Herramientas',
          description: 'Vista kanban para disponibilidad, asignaciones y mantenimiento.',
          showCreateAction: true
        }
      },
      {
        path: 'inventario',
        component: InventoryPageComponent,
        data: {
          eyebrow: 'Control Diario',
          title: 'Inventario',
          description: 'Listado operativo para revisar y actualizar rapidamente todo el parque.',
          showCreateAction: true
        }
      },
      {
        path: 'categorias',
        component: CategoriesPageComponent,
        data: {
          eyebrow: 'Agrupacion',
          title: 'Categorias',
          description: 'Resumen por familias de herramientas con disponibilidad y materiales.',
          showCreateAction: false
        }
      },
      {
        path: 'reportes',
        component: ReportsPageComponent,
        data: {
          eyebrow: 'Analitica',
          title: 'Reportes',
          description: 'Lectura rapida del estado general, uso y composicion del inventario.',
          showCreateAction: false
        }
      },
      {
        path: 'arreglos',
        component: RepairsPageComponent,
        data: {
          eyebrow: 'Mantenimiento',
          title: 'Seguimiento de Arreglos',
          description: 'Registro visual del historial de reparaciones y seguimiento por herramienta.',
          showCreateAction: false
        }
      },
      {
        path: 'tecnicos',
        component: TechniciansPageComponent,
        data: {
          eyebrow: 'Equipo',
          title: 'Gestion de Tecnicos',
          description: 'Alta, edicion y disponibilidad del personal que realiza los arreglos.',
          showCreateAction: false
        }
      },
      {
        path: 'configuracion',
        component: SettingsPageComponent,
        data: {
          eyebrow: 'Entorno',
          title: 'Configuracion',
          description: 'Preferencias del frontend y recordatorios del entorno actual.',
          showCreateAction: false
        }
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'tablero'
  }
];
