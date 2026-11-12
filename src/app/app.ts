import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastStackComponent } from './components/toast-stack.component';
import { ConfirmDialogComponent } from './components/confirm-dialog.component';
import { TelemetryService } from './services/telemetry.service';
import { ActiveUserService } from './services/active-user.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastStackComponent, ConfirmDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private readonly telemetry = inject(TelemetryService);
  private readonly activeUsers = inject(ActiveUserService);
}
