import {
  Component,
  EventEmitter,
  Output,
  Input,
  signal,
  HostListener
} from '@angular/core';

@Component({
  selector: 'app-dropdown-menu',
  standalone: true,
  templateUrl: './dropdown-menu.component.html',
  styleUrls: ['./dropdown-menu.component.scss']
})
export class DropdownMenuComponent {

  @Input() items: { label: string; value: string }[] = [];
  @Output() action = new EventEmitter<string>();

  open = signal(false);

  toggle() {
    this.open.update(v => !v);
  }

  select(value: string) {
    this.action.emit(value);
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    const target = event.target as HTMLElement;

    if (!target.closest('.dropdown')) {
      this.open.set(false);
    }
  }
}