import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { supabase } from 'src/app/supabase';
import { ensureUsuarioId } from 'src/app/utils/auth-usuario';

type Perfil = {
  id_perfil: number;
  id_usuario: number;
  biografia: string | null;
  rubro: string | null;
  whatsapp_url: string | null;
  linkedin_url: string | null;
  visibilidad: 'publico' | 'privado';
  reputacion: number | null;
  edad: number | null;
  meses_experiencia: number | null;
};

type SolicitudRow = {
  id: number;
  estado: 'pendiente'|'aprobado'|'rechazado';
  created_at: string;
  proyecto?: { id_proyecto:number; nombre:string } | null;
  publicacion?: { id_publicacion:number; titulo:string|null; tipo:string } | null;
};

@Component({
  standalone: true,
  selector: 'app-colaborar',
  templateUrl: './colaborar.page.html',
  styleUrls: ['./colaborar.page.scss'],
  imports: [CommonModule, IonicModule, FormsModule],
})
export class ColaborarPage implements OnInit {
  cargando = true;
  guardando = false;

  meId!: number;

  // mi perfil (si existe)
  miPerfil: Perfil | null = null;

  // form (crear/editar)
  form = {
    biografia: '',
    rubro: '',
    whatsapp_url: '',
    linkedin_url: '',
    visibilidad: 'publico' as 'publico'|'privado',
    meses_experiencia: null as number | null,
    edad: null as number | null,
  };

  // estado “visual” del colaborador (derivado)
  estadoColaborador = computed<'pendiente'|'aprobado'|'sin_perfil'>(() => {
    if (!this.miPerfil) return 'sin_perfil';
    // Si más adelante agregás una columna “estado_colaborador”, usala acá.
    // Por ahora, con tener perfil consideramos “aprobado” para habilitar CTA.
    return 'aprobado';
  });

  // mis solicitudes
  solicitudes: SolicitudRow[] = [];

  constructor(private toast: ToastController) {}

  async ngOnInit() {
    await this.init();
  }

  private async t(msg: string) {
    const x = await this.toast.create({ message: msg, duration: 1600, position: 'bottom' });
    x.present();
  }

  private async init() {
    this.cargando = true;
    try {
      this.meId = await ensureUsuarioId();
      await Promise.all([ this.cargarMiPerfil(), this.cargarSolicitudes() ]);
    } catch (e) {
      console.error('[Colaborar] init', e);
      this.t('No pude cargar tus datos');
    } finally {
      this.cargando = false;
    }
  }

  private async cargarMiPerfil() {
    const { data } = await supabase
      .from('perfil')
      .select('*')
      .eq('id_usuario', this.meId)
      .maybeSingle();

    this.miPerfil = (data ?? null) as Perfil | null;

    if (this.miPerfil) {
      this.form = {
        biografia: this.miPerfil.biografia ?? '',
        rubro: this.miPerfil.rubro ?? '',
        whatsapp_url: this.miPerfil.whatsapp_url ?? '',
        linkedin_url: this.miPerfil.linkedin_url ?? '',
        visibilidad: this.miPerfil.visibilidad ?? 'publico',
        meses_experiencia: this.miPerfil.meses_experiencia ?? null,
        edad: this.miPerfil.edad ?? null,
      };
    } else {
      // listo para crear
      this.form = {
        biografia: '',
        rubro: '',
        whatsapp_url: '',
        linkedin_url: '',
        visibilidad: 'publico',
        meses_experiencia: null,
        edad: null,
      };
    }
  }

  private async cargarSolicitudes() {
    const { data, error } = await supabase
      .from('solicitud_colaborador')
      .select(`
        id, estado, created_at,
        proyecto:proyecto!inner(id_proyecto, nombre),
        publicacion:publicacion(id_publicacion, titulo, tipo)
      `)
      .eq('id_usuario', this.meId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      this.solicitudes = [];
      return;
    }
    this.solicitudes = (data ?? []) as any[];
  }

  // ===== Crear / Actualizar Perfil =====
  async guardar() {
    this.guardando = true;
    try {
      const payload = {
        biografia: (this.form.biografia || '').trim() || null,
        rubro: (this.form.rubro || '').trim() || null,
        whatsapp_url: (this.form.whatsapp_url || '').trim() || null,
        linkedin_url: (this.form.linkedin_url || '').trim() || null,
        visibilidad: this.form.visibilidad,
        meses_experiencia: this.form.meses_experiencia == null ? null : Number(this.form.meses_experiencia),
        edad: this.form.edad == null ? null : Number(this.form.edad),
      };

      if (!this.miPerfil) {
        // crear
        const { error } = await supabase
          .from('perfil')
          .insert([{ id_usuario: this.meId, ...payload }]);
        if (error) throw error;
        await this.t('Perfil creado ✅');
      } else {
        // actualizar
        const { error } = await supabase
          .from('perfil')
          .update(payload)
          .eq('id_perfil', this.miPerfil.id_perfil);
        if (error) throw error;
        await this.t('Perfil actualizado ✅');
      }

      await this.cargarMiPerfil();
    } catch (e) {
      console.error('[Colaborar] guardar', e);
      this.t('No pude guardar tu perfil');
    } finally {
      this.guardando = false;
    }
  }
}