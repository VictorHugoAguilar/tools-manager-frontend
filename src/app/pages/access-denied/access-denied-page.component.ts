import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-access-denied-page',
  imports: [RouterLink],
  template: `
    <main class="identity-page">
      <section class="identity-card">
        <p class="eyebrow">Acceso restringido</p>
        <h1>Acceso denegado</h1>
        <p class="identity-copy">Tu cuenta no tiene permisos para consultar esta página.</p>
        <a class="identity-primary" routerLink="/tablero">Volver a la aplicación</a>
      </section>
    </main>
  `,
  styleUrl: './access-denied-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccessDeniedPageComponent {}
