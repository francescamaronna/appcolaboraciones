import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { supabase } from '../../supabase'; // ruta: src/app/supabase.ts
import { ensureUsuarioId } from '../../utils/auth-usuario';


@Component({
  selector: 'app-publicaciones',
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
  templateUrl: './publicaciones.page.html',
  styleUrls: ['./publicaciones.page.scss'],
})
export class PublicacionesPage {
  publicaciones: any[] = [];
  nuevaPublicacion = { tipo: '', descripcion: '', estado: 'activa' };

  editando = false;
  publicacionEditando: any = null;

  // TODO: reemplazar por el id del usuario logueado
  private currentUserId! : number;

  constructor(private toast: ToastController) {}

  async ngOnInit() {
    this.currentUserId = await ensureUsuarioId();
    await this.cargarPublicaciones();
  }

  private async toastMsg(message: string) {
    const t = await this.toast.create({ message, duration: 1800, position: 'bottom' });
    await t.present();
  }

  async cargarPublicaciones() {
    try {
      const { data, error } = await supabase
        .from('publicacion')
        .select('*')
        .eq('id_usuario', this.currentUserId)
        .order('fecha_creacion', { ascending: false });

      if (error) throw error;
      this.publicaciones = data ?? [];
    } catch (e) {
      console.error('Error cargando publicaciones (supabase):', e);
      this.publicaciones = [];
      this.toastMsg('No pude cargar publicaciones');
    }
  }

  async agregarPublicacion() {
  try {
    const tipo = this.nuevaPublicacion.tipo?.trim();
    const descripcion = this.nuevaPublicacion.descripcion?.trim() || null;

    if (!tipo) {
      this.toastMsg('Completá el campo "Tipo"');
      return;
    }

    // Aseguro que tengo el usuarioId (por si el usuario vino directo a esta página)
    if (!this.currentUserId) {
      this.currentUserId = await ensureUsuarioId();
    }

    const { data, error } = await supabase
      .from('publicacion')
      .insert([{
        id_usuario: this.currentUserId,                // 👈 usa el id real
        tipo,
        descripcion,
        estado: this.nuevaPublicacion.estado || 'activa',
      }])
      .select()
      .single();

    if (error) throw error;

    this.nuevaPublicacion = { tipo: '', descripcion: '', estado: 'activa' };
    await this.cargarPublicaciones();
    this.toastMsg('Publicación creada ✔️');
  } catch (e: any) {
    console.error('Error agregando publicación (supabase):', e);
    this.toastMsg(e?.message || 'No pude guardar la publicación');
  }
}


  editarPublicacion(pub: any) {
    this.editando = true;
    this.publicacionEditando = { ...pub };
  }

  async guardarEdicion() {
    try {
      if (!this.publicacionEditando?.id_publicacion) return;

      const body = {
        tipo: this.publicacionEditando.tipo?.trim() || null,
        descripcion: this.publicacionEditando.descripcion?.trim() || null,
        estado: this.publicacionEditando.estado || 'activa',
      };

      const { error } = await supabase
        .from('publicacion')
        .update(body)
        .eq('id_publicacion', this.publicacionEditando.id_publicacion);

      if (error) throw error;

      this.editando = false;
      this.publicacionEditando = null;
      await this.cargarPublicaciones();
      this.toastMsg('Publicación actualizada ✔️');
    } catch (e: any) {
      console.error('Error guardando edición (supabase):', e);
      this.toastMsg(e?.message || 'No pude actualizar');
    }
  }

  async eliminarPublicacion(id: number) {
    try {
      const { error } = await supabase
        .from('publicacion')
        .delete()
        .eq('id_publicacion', id);

      if (error) throw error;

      await this.cargarPublicaciones();
      this.toastMsg('Publicación eliminada 🗑️');
    } catch (e: any) {
      console.error('Error eliminando (supabase):', e);
      this.toastMsg(e?.message || 'No pude eliminar');
    }
  }
}