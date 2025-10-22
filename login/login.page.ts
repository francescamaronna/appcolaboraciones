import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController, LoadingController } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { Auth } from 'src/app/services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [CommonModule, FormsModule, RouterModule, IonicModule]
})
export class LoginPage {
  email = '';
  password = '';
  errorMessage = '';

  constructor(
    private auth: Auth,
    private router: Router,
    private toast: ToastController,
    private loading: LoadingController
  ) {}

  async login() {
    if (!this.email || !this.password) return this.setError('Completá email y contraseña');
    const load = await this.loading.create({ message: 'Ingresando...' }); await load.present();

    const { data, error } = await this.auth.login(this.email, this.password);
    await load.dismiss();

    if (error) return this.setError(error.message);
    if (data.user) await this.auth.ensureUsuario(data.user.id, this.email);
    this.router.navigateByUrl('/tabs', { replaceUrl: true });
  }

  async registerEmail() {
    if (!this.email || !this.password) return this.setError('Completá email y contraseña');
    const load = await this.loading.create({ message: 'Creando cuenta...' }); await load.present();

    const { data, error } = await this.auth.register(this.email, this.password);
    await load.dismiss();

    if (error) return this.setError(error.message);
    if (data.user) await this.auth.ensureUsuario(data.user.id, this.email);

    this.msg('Revisá tu correo si tu proyecto requiere verificación');
  }

  async loginGoogle() {
    const { error } = await this.auth.loginWithGoogle(window.location.origin + '/oauth');
    if (error) this.setError(error.message);
  }

  private async msg(message: string) {
    const t = await this.toast.create({ message, duration: 2000, position: 'bottom' });
    t.present();
  }
  private setError(msg: string) { this.errorMessage = msg; }
}