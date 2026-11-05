import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DrawingApiService } from '../../services/drawing-api.service';

@Component({
  selector: 'app-drawing-share-link-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="share-link-state" aria-live="polite">
      @if (loading()) {
        <strong>Abriendo pizarra compartida…</strong>
      } @else {
        <strong>No se pudo abrir el enlace</strong>
        <span>{{ error() }}</span>
        <a routerLink="/dibujar">Ir a la biblioteca</a>
      }
    </section>
  `,
  styleUrl: './drawing-share-link-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DrawingShareLinkPageComponent implements OnInit {
  private readonly api = inject(DrawingApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loading = signal(true);
  protected readonly error = signal('');

  ngOnInit(): void {
    void this.openLink();
  }

  private async openLink(): Promise<void> {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.error.set('El enlace de lectura no es válido.');
      this.loading.set(false);
      return;
    }
    try {
      const { documentId } = await firstValueFrom(this.api.resolveShareLink(token));
      await this.router.navigate(['/dibujar', documentId], { replaceUrl: true });
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
        this.error.set(error.error.message);
      } else {
        this.error.set('No se pudo validar el enlace. Inténtalo de nuevo.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
