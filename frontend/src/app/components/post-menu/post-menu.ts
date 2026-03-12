import { Component, input, output } from '@angular/core';

export interface MenuAction {
  label: string;
  disabled?: boolean;
  danger?: boolean;
}

@Component({
  selector: 'app-post-menu',
  imports: [],
  templateUrl: './post-menu.html',
  styleUrl: './post-menu.scss',
})
export class PostMenu {
  readonly actions = input<MenuAction[]>([]);
  readonly isOpen = input(false);
  // sm = in comments, md = op posts
  readonly size = input<'sm' | 'md'>('md');

  readonly trigger = output<MouseEvent>();
  readonly actionSelected = output<number>();
}
