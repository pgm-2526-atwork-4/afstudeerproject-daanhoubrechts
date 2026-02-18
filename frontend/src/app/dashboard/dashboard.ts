import { Component } from '@angular/core';
import { Button } from '../components/button/button';

@Component({
  selector: 'app-dashboard',
  imports: [Button],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {}
