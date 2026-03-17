import { Component, input, output } from '@angular/core';

export interface Tab {
  id: string;
  label: string;
}

@Component({
  selector: 'app-tabs',
  imports: [],
  templateUrl: './tabs.html',
  styleUrl: './tabs.scss',
})
export class Tabs {
  readonly tabs = input<Tab[]>([]);
  readonly activeTab = input('');

  readonly tabChange = output<string>();

  selectTab(id: string): void {
    this.tabChange.emit(id);
  }
}
