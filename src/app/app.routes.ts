import { Routes } from '@angular/router';
import { AppShellComponent } from './components/app-shell.component';
import { DashboardPageComponent } from './pages/dashboard/dashboard-page.component';
import { InventoryPageComponent } from './pages/inventory/inventory-page.component';
import { CategoriesPageComponent } from './pages/categories/categories-page.component';
import { ReportsPageComponent } from './pages/reports/reports-page.component';
import { RepairsPageComponent } from './pages/repairs/repairs-page.component';
import { SettingsPageComponent } from './pages/settings/settings-page.component';
import { TechniciansPageComponent } from './pages/technicians/technicians-page.component';
import { StoragePageComponent } from './pages/storage/storage-page.component';
import { WorkshopStoragePageComponent } from './pages/workshop-storage/workshop-storage-page.component';
import { drawingEditorCanDeactivateGuard } from './pages/drawing/drawing-editor.guard';
import { adminGuard, authGuard, monitoringGuard } from './guards/auth.guard';

export const appRoutes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login-page.component').then((module) => module.LoginPageComponent) },
  { path: 'registro', loadComponent: () => import('./pages/register/register-page.component').then((module) => module.RegisterPageComponent) },
  { path: 'restablecer-contrasena', loadComponent: () => import('./pages/reset-password/reset-password-page.component').then((module) => module.ResetPasswordPageComponent) },
  { path: 'acceso-denegado', loadComponent: () => import('./pages/access-denied/access-denied-page.component').then((module) => module.AccessDeniedPageComponent) },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
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
          showCreateAction: true,
          showGlobalSearch: true
        }
      },
      {
        path: 'inventario',
        component: InventoryPageComponent,
        data: {
          eyebrow: 'Control Diario',
          title: 'Inventario',
          description: 'Listado operativo para revisar y actualizar rapidamente todo el parque.',
          showCreateAction: true,
          showGlobalSearch: true
        }
      },
      {
        path: 'almacenamiento',
        component: StoragePageComponent,
        data: {
          eyebrow: 'Logistica',
          title: 'Almacenamiento',
          description: 'Gestion visual de cajas, productos almacenados y acceso rapido por QR.',
          showCreateAction: false
        }
      },
      {
        path: 'almacenamiento/:boxId',
        component: StoragePageComponent,
        data: {
          eyebrow: 'Logistica',
          title: 'Almacenamiento',
          description: 'Gestion visual de cajas, productos almacenados y acceso rapido por QR.',
          showCreateAction: false
        }
      },
      {
        path: 'almacenamiento-taller',
        component: WorkshopStoragePageComponent,
        data: {
          eyebrow: 'Logística',
          title: 'Inventario del taller',
          description: 'Configuración física de estanterías y localización de materiales por compartimento.',
          showCreateAction: false
        }
      },
      {
        path: 'listas-tareas',
        loadComponent: () => import('./pages/task-board/task-board-page.component')
          .then((module) => module.TaskBoardPageComponent),
        data: {
          eyebrow: 'Organización',
          title: 'Listas de tareas',
          description: 'Organiza y controla tus tareas de forma visual.',
          showCreateAction: false,
        }
      },
      {
        path: 'todo-list',
        loadComponent: () => import('./pages/todo-list/todo-list-page.component')
          .then((module) => module.TodoListPageComponent),
        data: {
          eyebrow: 'Organización',
          title: 'Tareas',
          description: 'Organiza, planifica y gestiona todas tus tareas de forma sencilla y eficiente.',
          showCreateAction: false,
        }
      },
      {
        path: 'dibujar',
        loadComponent: () => import('./pages/drawing/drawing-library-page.component')
          .then((module) => module.DrawingLibraryPageComponent),
        data: {
          eyebrow: 'Herramientas',
          title: 'Dibujar',
          description: 'Crea diagramas, esquemas y visualiza tus ideas de forma rápida y sencilla.',
          showCreateAction: false
        }
      },
      {
        path: 'dibujar/shared/:token',
        loadComponent: () => import('./pages/drawing/drawing-share-link-page.component')
          .then((module) => module.DrawingShareLinkPageComponent),
        data: {
          eyebrow: 'Herramientas',
          title: 'Pizarra compartida',
          description: 'Abriendo una pizarra compartida.',
          showCreateAction: false
        }
      },
      {
        path: 'dibujar/:documentId',
        loadComponent: () => import('./pages/drawing/drawing-editor-page.component')
          .then((module) => module.DrawingEditorPageComponent),
        canDeactivate: [drawingEditorCanDeactivateGuard],
        data: {
          eyebrow: 'Herramientas',
          title: 'Dibujar',
          description: 'Crea diagramas, esquemas y visualiza tus ideas de forma rápida y sencilla.',
          showCreateAction: false
        }
      },
      {
        path: 'categorias',
        component: CategoriesPageComponent,
        data: {
          eyebrow: 'Agrupación',
          title: 'Categorias',
          description: 'Resumen por familias de herramientas con disponibilidad y materiales.',
          showCreateAction: false,
          showGlobalSearch: true
        }
      },
      {
        path: 'reportes',
        component: ReportsPageComponent,
        data: {
          eyebrow: 'Analítica',
          title: 'Reportes',
          description: 'Lectura rapida del estado general, uso y composicion del inventario.',
          showCreateAction: false
        }
      },
      {
        path: 'monitorizacion',
        canActivate: [monitoringGuard],
        loadComponent: () => import('./pages/monitoring/monitoring-page.component')
          .then((module) => module.MonitoringPageComponent),
        data: {
          eyebrow: 'Administración',
          title: 'Monitorización',
          description: 'Salud y actividad de la aplicación.',
          showCreateAction: false,
          showPageHeader: false
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
          title: 'Gestión de Técnicos',
          description: 'Alta, edicion y disponibilidad del personal que realiza los arreglos.',
          showCreateAction: false
        }
      },
      {
        path: 'configuracion',
        component: SettingsPageComponent,
        data: {
          eyebrow: 'Entorno',
          title: 'Configuración',
          description: 'Preferencias del frontend y recordatorios del entorno actual.',
          showCreateAction: false
        }
      },
      {
        path: 'mi-perfil',
        loadComponent: () => import('./pages/profile/profile-page.component').then((module) => module.ProfilePageComponent),
        data: {
          eyebrow: 'Cuenta',
          title: 'Mi perfil',
          description: 'Consulta y actualiza tu información personal y de seguridad.',
          showCreateAction: false
        }
      },
      {
        path: 'usuarios',
        loadComponent: () => import('./pages/users/users-page.component').then((module) => module.UsersPageComponent),
        canActivate: [adminGuard],
        data: {
          eyebrow: 'Administración',
          title: 'Gestión de usuarios',
          description: 'Administra cuentas, roles y permisos de acceso.',
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
