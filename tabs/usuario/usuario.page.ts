import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';            // 👈 NUEVO
import { supabase } from '../../supabase';
import { ensureUsuarioId } from '../../utils/auth-usuario';

type Usuario = {
  id_usuario: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string | null;
  zona_horaria?: string | null;
  pais?: string | null;
  id_plan?: number | null;
};

type Suscripcion = {
  id_suscripcion: number;
  id_usuario: number;
  id_plan: number;
  estado: 'activa' | 'pendiente' | 'pausada' | 'vencida' | 'cancelada';
  inicio: string;
  fin?: string | null;
};

type Plan = { id_plan: number; nombre: string; precio: number; techo?: number | null };

@Component({
  selector: 'app-usuario',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
  templateUrl: './usuario.page.html',
  styleUrls: ['./usuario.page.scss'],
})
export class UsuarioPage {
  // Estado general
  currentUserId!: number;
  cargando = true;
  guardando = false;
  lastUpdated?: Date;

  // Modo de la UI
  modo: 'view' | 'edit' = 'view';

  // Datos
  usuario!: Usuario;                 // vista
  editable: Usuario | null = null;   // formulario
  usuarioOriginal: Usuario | null = null;

  // Suscripción/plan
  suscripcion: (Suscripcion & { plan?: Plan }) | null = null;
  fallbackPlan: Plan | null = null;

  constructor(
    private toast: ToastController,
    private router: Router                    // 👈 NUEVO
  ) {}

  async ngOnInit() {
    await this.initData();
  }

  private async toastMsg(message: string) {
    const t = await this.toast.create({ message, duration: 1800, position: 'bottom' });
    await t.present();
  }

  private async initData() {
    this.cargando = true;
    try {
      this.currentUserId = await ensureUsuarioId();
      await this.cargarUsuario();
      await this.cargarSuscripcionYPlan();
    } catch (e) {
      console.error('[UsuarioPage] init error:', e);
      this.toastMsg('No pude cargar tus datos');
    } finally {
      this.cargando = false;
    }
  }

  private async cargarUsuario() {
    const { data, error } = await supabase
      .from('usuario')
      .select('id_usuario, nombre, apellido, email, telefono, zona_horaria, pais, id_plan')
      .eq('id_usuario', this.currentUserId)
      .single();
    if (error) throw error;
    this.usuario = data as Usuario;
    this.usuarioOriginal = { ...(this.usuario || {}) };
  }

  private async cargarSuscripcionYPlan() {
    const { data: sus, error: susErr } = await supabase
      .from('suscripcion')
      .select('id_suscripcion, id_usuario, id_plan, estado, inicio, fin')
      .eq('id_usuario', this.currentUserId)
      .order('inicio', { ascending: false })
      .limit(1);
    if (susErr) throw susErr;

    if (sus && sus.length > 0) {
      const s = sus[0] as Suscripcion;
      const { data: planData, error: planErr } = await supabase
        .from('plan')
        .select('id_plan, nombre, precio, techo')
        .eq('id_plan', s.id_plan)
        .single();
      if (planErr) throw planErr;
      this.suscripcion = { ...s, plan: planData as Plan };
      this.fallbackPlan = null;
    } else {
      this.suscripcion = null;
      this.fallbackPlan = null;
      if (this.usuario?.id_plan) {
        const { data: planData } = await supabase
          .from('plan')
          .select('id_plan, nombre, precio, techo')
          .eq('id_plan', this.usuario.id_plan)
          .single();
        if (planData) this.fallbackPlan = planData as Plan;
      }
    }
  }

  // ---------- UI helpers ----------
  get displayName() {
    return `${this.usuario?.nombre ?? ''} ${this.usuario?.apellido ?? ''}`.trim();
  }
  get iniciales() {
    const n = (this.usuario?.nombre || '').trim()[0] || '';
    const a = (this.usuario?.apellido || '').trim()[0] || '';
    return (n + a).toUpperCase();
  }

  editar() {
    this.modo = 'edit';
    this.editable = { ...(this.usuario || {}) };
  }

  cancelar() {
    this.modo = 'view';
    this.editable = null;
  }

  async guardarUsuario() {
    if (!this.editable) return;
    if (!this.editable?.nombre?.trim() || !this.editable?.apellido?.trim()) {
      this.toastMsg('Completá nombre y apellido');
      return;
    }
    this.guardando = true;

    try {
      const payload = {
        nombre: this.editable.nombre.trim(),
        apellido: this.editable.apellido.trim(),
        telefono: this.editable.telefono?.trim() || null,
        zona_horaria: this.editable.zona_horaria?.trim() || null,
        pais: this.editable.pais?.trim() || null,
      };

      const { data, error } = await supabase
        .from('usuario')
        .update(payload)
        .eq('id_usuario', this.currentUserId)
        .select('id_usuario')
        .single();

      if (error) throw error;
      if (!data) throw new Error('No se actualizó ninguna fila');

      // Refrescamos la vista y volvemos a modo "ver"
      await this.cargarUsuario();
      this.lastUpdated = new Date();
      this.modo = 'view';
      this.editable = null;
      this.toastMsg('Datos guardados ✔️');
    } catch (e: any) {
      console.error('[UsuarioPage] guardar error:', e);
      this.toastMsg(e?.message || 'No pude guardar tus datos');
    } finally {
      this.guardando = false;
    }
  }

  async onRefresh(ev: any) {
    try {
      await this.cargarUsuario();
      await this.cargarSuscripcionYPlan();
    } finally {
      ev.target.complete();
    }
  }

  async cerrarSesion() {
    try {
      await supabase.auth.signOut();
      this.toastMsg('Sesión cerrada');
      // this.router.navigateByUrl('/login', { replaceUrl: true });
    } catch (e) {
      console.error('Error al cerrar sesión:', e);
      this.toastMsg('No pude cerrar la sesión');
    }
  }

  // ---------- 🔴 ELIMINAR CUENTA ----------
  async eliminarCuenta() {
    const ok = confirm('¿Eliminar tu cuenta? Esta acción no se puede deshacer.');
    if (!ok) return;

    try {
      const id = this.usuario?.id_usuario;
      if (!id) throw new Error('Usuario no cargado');

      const { error } = await supabase
        .from('usuario')
        .delete()
        .eq('id_usuario', id);

      if (error) throw error;

      await this.toastMsg('Cuenta eliminada');
      // Opcional: cerrar sesión/redirigir al login
      // await supabase.auth.signOut();
      this.router.navigateByUrl('/login');
    } catch (e) {
      console.error('[usuario] eliminarCuenta error:', e);
      await this.toastMsg('No pude eliminar la cuenta');
    }
  }
}