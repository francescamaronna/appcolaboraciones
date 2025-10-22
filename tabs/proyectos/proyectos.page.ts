// src/app/tabs/proyectos/proyectos.page.ts
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { supabase } from 'src/app/supabase';
import { ensureUsuarioId } from 'src/app/utils/auth-usuario';
import { SolicitudesComponent } from './solicitudes.component';

type Proyecto = {
  id_proyecto: number;
  id_responsable: number | null;
  nombre: string;
  descripcion?: string | null;
  estado: 'activo' | 'pausado' | 'archivado';
  created_at: string;
};

type ProyectoCard = Proyecto & {
  publicaciones_activas: number;
  colaboradores_activos: number;
  pendientes?: number; // solo se calcula si sos responsable
  esResponsable: boolean;
};

type Publicacion = {
  id_publicacion: number;
  id_proyecto: number | null;
  id_usuario: number | null;
  tipo: 'oferta' | 'busqueda' | 'anuncio';
  titulo: string | null;
  descripcion: string | null;
  estado: 'activa' | 'pausada' | 'cerrada' | 'eliminada';
  fecha_creacion: string | null;
  habilidades: string[] | null;
  proyecto?: { id_proyecto: number; nombre: string } | null;
  autor?: { id_usuario: number; nombre: string } | null;
};

type ColabVista = {
  id_usuario: number;
  nombre: string;
  promedio_estrellas: number;
  cantidad_calificaciones: number;
};

@Component({
  standalone: true,
  selector: 'app-proyectos',
  templateUrl: './proyectos.page.html',
  styleUrls: ['./proyectos.page.scss'],
  imports: [CommonModule, IonicModule, FormsModule, SolicitudesComponent],
})
export class ProyectosPage implements OnInit {
  cargando = true;
  meId: number | null = null;

  // listado + filtro
  proyectos: ProyectoCard[] = [];
  filtroTexto = '';

  // detalle (modal)
  abierto = signal(false);
  seleccionado: ProyectoCard | null = null;
  pubs: Publicacion[] = [];
  colabs: ColabVista[] = [];
  creandoSolicitud = false;

  constructor(private toast: ToastController) {}

  async ngOnInit() {
    await this.init();
  }

  private async t(msg: string, danger = false) {
    const x = await this.toast.create({
      message: msg,
      duration: 1600,
      position: 'bottom',
      color: danger ? 'danger' : undefined,
    });
    x.present();
  }

  private async getAuthUserUuid(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  }

  private async init() {
    this.cargando = true;
    try {
      // usuario app (puede ser null si no logueó)
      try {
        this.meId = await ensureUsuarioId();
      } catch {
        this.meId = null;
      }

      // 1) proyectos activos
      const { data: proys, error } = await supabase
        .from('proyecto')
        .select('id_proyecto,id_responsable,nombre,descripcion,estado,created_at')
        .eq('estado', 'activo')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 2) contadores por proyecto (publicaciones / colaboradores / pendientes si soy responsable)
      const cards: ProyectoCard[] = [];
      for (const p of (proys ?? []) as Proyecto[]) {
        const [pubsCount, colabsCount, pendCount] = await Promise.all([
          supabase
            .from('publicacion')
            .select('id_publicacion', { count: 'exact', head: true })
            .eq('estado', 'activa')
            .eq('id_proyecto', p.id_proyecto),
          supabase
            .from('colaborador_proyecto')
            .select('*', { count: 'exact', head: true })
            .eq('estado', 'activo')
            .eq('id_proyecto', p.id_proyecto),
          (this.meId && p.id_responsable === this.meId)
            ? supabase
                .from('solicitud_colaborador')
                .select('*', { count: 'exact', head: true })
                .eq('estado', 'pendiente')
                .eq('id_proyecto', p.id_proyecto)
            : Promise.resolve({ count: 0 } as any),
        ]);

        cards.push({
          ...p,
          esResponsable: !!this.meId && p.id_responsable === this.meId,
          publicaciones_activas: pubsCount.count ?? 0,
          colaboradores_activos: colabsCount.count ?? 0,
          pendientes:
            this.meId && p.id_responsable === this.meId
              ? (pendCount.count ?? 0)
              : undefined,
        });
      }

      this.proyectos = cards;
    } catch (e) {
      console.error('[Proyectos] init', e);
      this.t('No pude cargar proyectos', true);
    } finally {
      this.cargando = false;
    }
  }

  get proyectosFiltrados() {
    const q = (this.filtroTexto || '').trim().toLowerCase();
    if (!q) return this.proyectos;
    return this.proyectos.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        (p.descripcion || '').toLowerCase().includes(q),
    );
  }

  // ===== Detalle =====
  async abrirDetalle(p: ProyectoCard) {
    this.seleccionado = p;
    this.abierto.set(true);

    // publicaciones del proyecto (activas)
    const { data: pubs } = await supabase
      .from('publicacion')
      .select(
        `
        id_publicacion,id_proyecto,id_usuario,tipo,titulo,descripcion,estado,fecha_creacion,habilidades,
        proyecto:proyecto!publicacion_id_proyecto_fkey (id_proyecto,nombre),
        autor:usuario!publicacion_id_usuario_fkey (id_usuario,nombre)
      `,
      )
      .eq('id_proyecto', p.id_proyecto)
      .eq('estado', 'activa')
      .order('fecha_creacion', { ascending: false });

    this.pubs = (pubs ?? []) as any[];

    // colaboradores (vista con promedio ⭐)
    const { data: v } = await supabase
      .from('v_colaboradores_proyecto')
      .select(
        'id_usuario,nombre,promedio_estrellas,cantidad_calificaciones',
      )
      .eq('id_proyecto', p.id_proyecto)
      .order('promedio_estrellas', { ascending: false });

    this.colabs = (v ?? []) as ColabVista[];
  }

  cerrarDetalle() {
    this.abierto.set(false);
    this.seleccionado = null;
    this.pubs = [];
    this.colabs = [];
  }

  // ===== CTA: Solicitar unirme =====
  deshabilitarSolicitar(): boolean {
    // Si no hay usuario app -> no puede
    if (!this.meId) return true;
    // Podrías chequear estado de perfil/colaborador aquí si lo necesitas.
    return false;
  }

  async solicitarUnirme(pub?: Publicacion) {
    if (!this.seleccionado || !this.meId) {
      this.t('Debés iniciar sesión', true);
      return;
    }
    this.creandoSolicitud = true;
    try {
      const payload: any = {
        id_proyecto: this.seleccionado.id_proyecto,
        id_usuario: this.meId,
        estado: 'pendiente',
      };
      if (pub?.id_publicacion) payload.id_publicacion = pub.id_publicacion;

      const { error } = await supabase
        .from('solicitud_colaborador')
        .insert([payload]);

      if (error) throw error;
      await this.t('Solicitud enviada ✅');

      // refresco contadores si soy responsable (para ver “pendientes”)
      await this.init();

      // si sigo con el modal abierto, refresco su contenido también
      if (this.seleccionado) await this.abrirDetalle(this.seleccionado);
    } catch (e) {
      console.error('[Proyectos] solicitarUnirme', e);
      this.t('No pude enviar la solicitud', true);
    } finally {
      this.creandoSolicitud = false;
    }
  }

  // ===== Gestión simple (solo responsable) =====
  async aprobarSolicitud(idSolicitud: number) {
    // si no sos responsable de este proyecto, no continúes (defensa extra en front)
    if (!this.seleccionado?.esResponsable) {
      this.t('No tenés permisos para aprobar', true);
      return;
    }
    try {
      const decidedBy = await this.getAuthUserUuid();
      const { error } = await supabase
        .from('solicitud_colaborador')
        .update({
          estado: 'aprobado',
          decided_at: new Date().toISOString(),
          decided_by: decidedBy,
        })
        .eq('id', idSolicitud);

      if (error) throw error;

      await this.t('Solicitud aprobada ✔️');

      // refrescar lista de proyectos (para el chip de pendientes)
      await this.init();

      // refrescar detalle (para que desaparezca de pendientes)
      if (this.seleccionado) await this.abrirDetalle(this.seleccionado);
    } catch (e) {
      console.error('[Proyectos] aprobarSolicitud', e);
      this.t('No pude aprobar', true);
    }
  }

  async rechazarSolicitud(idSolicitud: number) {
    if (!this.seleccionado?.esResponsable) {
      this.t('No tenés permisos para rechazar', true);
      return;
    }
    try {
      const decidedBy = await this.getAuthUserUuid();
      const { error } = await supabase
        .from('solicitud_colaborador')
        .update({
          estado: 'rechazado',
          decided_at: new Date().toISOString(),
          decided_by: decidedBy,
        })
        .eq('id', idSolicitud);

      if (error) throw error;

      await this.t('Solicitud rechazada ✔️');
      await this.init();
      if (this.seleccionado) await this.abrirDetalle(this.seleccionado);
    } catch (e) {
      console.error('[Proyectos] rechazarSolicitud', e);
      this.t('No pude rechazar', true);
    }
  }
}