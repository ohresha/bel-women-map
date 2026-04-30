import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { MapComponent } from './components/map-component/map-component';
import { LoginComponent } from './components/login/login.component';
import { WomanDetailComponent } from './components/woman-detail/woman-detail.component';
import { HistoryContextComponent } from './components/history-context/history-context.component';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'map', component: MapComponent },
  { path: 'history-context', component: HistoryContextComponent },
  { path: 'woman/:id', component: WomanDetailComponent },
  { path: 'login', component: LoginComponent },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' }
];
