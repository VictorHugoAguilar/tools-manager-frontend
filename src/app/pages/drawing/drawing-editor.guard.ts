import type { CanDeactivateFn } from '@angular/router';
import type { DrawingEditorPageComponent } from './drawing-editor-page.component';

export const drawingEditorCanDeactivateGuard: CanDeactivateFn<DrawingEditorPageComponent> =
  (component) => component.canLeave();
