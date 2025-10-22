import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { supabase } from 'src/app/supabase';

/* ===== Tipos ===== */
type Pub = {
  id_publicacion: number;
  id_proyecto: number | null;
  titulo: string | null;
  descripcion: string | null;
  tipo: 'oferta' | 'busqueda' | 'anuncio';
  habilidades: string[] | null;
  fecha_creacion: string;
  proyecto_nombre: string | null;
  id_responsable: number | null;
  autor_nombre: string | null;
};

type Me = { id_usuario: number } | null;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage {
  // Usuario actual (fila en public.usuario) o null si visitante
  me: Me = null;

  // Datos
  publicaciones: Pub[] = [];
  proyectos: { id_proyecto: number; nombre: string }[] = [];

  // Estados por proyecto del usuario
  approvedProjectIds = new Set<number>();
  pendingProjectIds = new Set<number>();

  // Filtros
  filtroProyecto: number | '' = '';
  filtroTipo: '' | 'oferta' | 'busqueda' | 'anuncio' = '';

  cargando = false;

  constructor(private toast: ToastController, public router: Router) {}

  /* ===== Ciclo de vida ===== */
  async ionViewWillEnter() {
    await this.cargarUsuario();
    await Promise.all([this.cargarProyectos(), this.cargarEstadosColaborador()]);
    await this.cargarFeed();
  }

  /* ===== Carga de usuario actual ===== */
  private async cargarUsuario() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { this.me = null; return; }
    const { data } = await supabase
      .from('usuario')
      .select('id_usuario')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    this.me = data ?? null;
  }

  /* ===== Catálogo de proyectos (para filtro y labels) ===== */
  private async cargarProyectos() {
    const { data, error } = await supabase
      .from('proyecto')
      .select('id_proyecto, nombre')
      .eq('estado', 'activo')
      .order('nombre', { ascending: true });
    if (error) { this.msg(error.message); return; }
    this.proyectos = data || [];
  }

  /* ===== Estados del usuario en proyectos (aprobado / pendiente) ===== */
  private async cargarEstadosColaborador() {
    this.approvedProjectIds.clear();
    this.pendingProjectIds.clear();
    if (!this.me) return;

    // Aprobados (miembro activo)
    const { data: aprob } = await supabase
      .from('colaborador_proyecto')
      .select('id_proyecto')
      .eq('id_usuario', this.me.id_usuario)
      .eq('estado', 'activo');
    (aprob || []).forEach(r => this.approvedProjectIds.add(r.id_proyecto));

    // Pendientes (solicitud en curso)
    const { data: pend } = await supabase
      .from('solicitud_colaborador')
      .select('id_proyecto')
      .eq('id_usuario', this.me.id_usuario)
      .eq('estado', 'pendiente');
    (pend || []).forEach(r => this.pendingProjectIds.add(r.id_proyecto));
  }

  /* ===== Feed de publicaciones (todas, lectura pública) ===== */
  async cargarFeed() {
  this.cargando = true;

  // 1) Traigo publicaciones activas (sin joins)
  const pubsQ = supabase
    .from('publicacion')
    .select('id_publicacion,id_proyecto,titulo,descripcion,tipo,habilidades,fecha_creacion,estado')
    .eq('estado', 'activa')
    .order('fecha_creacion', { ascending: false })
    .limit(60);

  if (this.filtroProyecto) pubsQ.eq('id_proyecto', this.filtroProyecto);
  if (this.filtroTipo)     pubsQ.eq('tipo', this.filtroTipo);

  // 2) Traigo proyectos activos (nombre y responsable)
  const proysQ = supabase
    .from('proyecto')
    .select('id_proyecto,nombre,id_responsable')
    .eq('estado', 'activo');

  const [{ data: pubs, error: e1 }, { data: proys, error: e2 }] = await Promise.all([pubsQ, proysQ]);
  this.cargando = false;

  if (e1 || e2) {
    console.error('cargarFeed: ', e1 || e2);
    return this.msg((e1 || e2)?.message || 'Error al cargar publicaciones');
  }

  const mapProy = new Map((proys || []).map((p: any) => [p.id_proyecto, p]));

  this.publicaciones = (pubs || []).map((p: any) => {
    const pr = mapProy.get(p.id_proyecto);
    return {
      id_publicacion: p.id_publicacion,
      id_proyecto: p.id_proyecto,
      titulo: p.titulo,
      descripcion: p.descripcion,
      tipo: p.tipo,
      habilidades: p.habilidades || [],
      fecha_creacion: p.fecha_creacion,
      proyecto_nombre: pr?.nombre ?? null,
      id_responsable: pr?.id_responsable ?? null,
      autor_nombre: null, // si querés autor, luego agregamos otra query o arreglamos el join
    };
  });
}


  /* ===== Lógica de CTA por estado ===== */
  estadoCTA(pub: Pub): 'no-login' | 'pendiente' | 'aprobado' | 'no-asignado' {
    if (!this.me) return 'no-login';
    if (!pub.id_proyecto) return 'no-asignado'; // publicación sin proyecto asociado
    if (this.approvedProjectIds.has(pub.id_proyecto)) return 'aprobado';
    if (this.pendingProjectIds.has(pub.id_proyecto)) return 'pendiente';
    return 'no-asignado';
  }

  /* ===== Acciones ===== */
  async solicitarUnirme(pub: Pub) {
    if (!this.me) { this.router.navigateByUrl('/login'); return; }
    if (!pub.id_proyecto) { this.msg('Esta publicación no tiene proyecto asociado'); return; }
    if (this.approvedProjectIds.has(pub.id_proyecto)) { this.msg('Ya sos colaborador de este proyecto'); return; }
    if (this.pendingProjectIds.has(pub.id_proyecto))  { this.msg('Tu solicitud ya está pendiente'); return; }

    const nuevo = {
      id_proyecto: pub.id_proyecto,
      id_usuario: this.me.id_usuario,
      id_publicacion: pub.id_publicacion,
      estado: 'pendiente',
      mensaje: null,
      decided_by: null,
      decided_at: null,
    };
    const { error } = await supabase.from('solicitud_colaborador').insert(nuevo);
    if (error) return this.msg(error.message);

    this.pendingProjectIds.add(pub.id_proyecto);
    this.msg('Solicitud enviada ✔️');
  }

  async verColaboradores(pub: Pub) {
    if (!pub.id_proyecto) { this.msg('Proyecto no definido en esta publicación'); return; }
    const { data, error } = await supabase
      .from('v_colaboradores_proyecto')
      .select('id_usuario, nombre, promedio_estrellas, cantidad_calificaciones')
      .eq('id_proyecto', pub.id_proyecto)
      .order('promedio_estrellas', { ascending: false });
    if (error) return this.msg(error.message);

    const lista = (data || [])
      .map((c: any) => `• ${c.nombre} — ⭐ ${c.promedio_estrellas} (${c.cantidad_calificaciones})`)
      .join('\n') || 'Sin colaboradores aún';
    alert(`Colaboradores en ${pub.proyecto_nombre ?? 'Proyecto'}:\n\n${lista}`);
  }

  esResponsable(pub: Pub) {
    return !!this.me && !!pub.id_responsable && this.me.id_usuario === pub.id_responsable;
  }

  irGestion(pub: Pub) {
    if (!pub.id_proyecto) return;
    this.router.navigate(['/proyectos', pub.id_proyecto]); // define esta ruta al Detalle del proyecto
  }

  /* ===== Utils ===== */
  private async msg(message: string) {
    const t = await this.toast.create({ message, duration: 2000, position: 'bottom' });
    t.present();
  }
}