import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastStackComponent } from './components/toast-stack.component';
import { ConfirmDialogComponent } from './components/confirm-dialog.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastStackComponent, ConfirmDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {}
