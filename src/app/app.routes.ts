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
import { adminGuard, authGuard } from './guards/auth.guard';

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
