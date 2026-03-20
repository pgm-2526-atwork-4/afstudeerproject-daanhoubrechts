import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth/auth.guard';
import { Home } from './pages/home/home';
import { Dashboard } from './pages/dashboard/dashboard';
import { Kotgroepen } from './pages/kotgroepen/kotgroepen';
import { Kotinfo } from './pages/kotinfo/kotinfo';
import { Posts } from './pages/posts/posts';
import { Settings } from './pages/settings/settings';
import { Login } from './auth/login/login';
import { Register } from './auth/register/register';
import { Join } from './pages/join/join';
import { Issues } from './pages/issues/issues';
import { Todos } from './pages/todos/todos';
import { Kotkas } from './pages/kotkas/kotkas';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'login', component: Login, canActivate: [guestGuard] },
  { path: 'register', component: Register, canActivate: [guestGuard] },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard] },
  { path: 'kotgroepen', component: Kotgroepen, canActivate: [authGuard] },
  { path: 'kotgroepen/:id/kotinfo', component: Kotinfo, canActivate: [authGuard] },
  { path: 'kotgroepen/:id/posts', component: Posts, canActivate: [authGuard] },
  { path: 'kotgroepen/:id/issues', component: Issues, canActivate: [authGuard] },
  { path: 'kotgroepen/:id/todos', component: Todos, canActivate: [authGuard] },
  { path: 'kotgroepen/:id/kotkas', component: Kotkas, canActivate: [authGuard] },
  { path: 'join', component: Join, canActivate: [authGuard] },
  { path: 'settings', component: Settings, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
