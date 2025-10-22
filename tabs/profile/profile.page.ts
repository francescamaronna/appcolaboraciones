import { Component, OnInit } from '@angular/core';
import { Auth } from 'src/app/services/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profile',
  template: '', // nada que mostrar
})
export class ProfilePage implements OnInit {
  constructor(private auth: Auth, private router: Router) {}

  async ngOnInit() {
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
