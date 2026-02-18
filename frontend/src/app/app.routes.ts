import { Routes } from '@angular/router';
import { Home } from './home/home';
import { Dashboard } from './dashboard/dashboard';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'dashboard', component: Dashboard },
];
