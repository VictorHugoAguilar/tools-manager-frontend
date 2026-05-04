import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'stateColor',
})
export class StateColorPipe implements PipeTransform {

  transform(state: string | null | undefined): string {
    if (!state) return 'badge-default';

    switch (state.toLowerCase()) {
      case 'disponible':
        return 'badge-primary';
      case 'en uso':
        return 'badge-secondary';
      case 'en mantenimiento':
        return 'badge-tertiary';
      default:
        return 'badge-default';
    }
  }

}
