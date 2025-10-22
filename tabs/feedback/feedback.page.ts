import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRange,
  IonLabel,
  IonTextarea,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,   // 👈 faltaba
  IonCardTitle,    // 👈 faltaba
  IonItem,
  IonList,
  IonInput,
} from '@ionic/angular/standalone';
import { supabase } from 'src/app/supabase';

@Component({
  selector: 'app-feedback',
  standalone: true,
  templateUrl: './feedback.page.html',
  styleUrls: ['./feedback.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonRange,
    IonLabel,
    IonTextarea,
    IonButton,
    IonCard,
    IonCardHeader,   // 👈 agregado
    IonCardTitle,    // 👈 agregado
    IonCardContent,
    IonItem,
    IonList,
    IonInput,
  ],
})
export class FeedbackPage implements OnInit {
  puntuacion = 5;
  estrellasVisuales = '⭐⭐⭐⭐⭐';
  comentario = '';
  mensaje = '';
  feedbacks: any[] = [];

  async ngOnInit() { await this.cargarFeedbacks(); }

  actualizarEstrellas() { this.estrellasVisuales = '⭐'.repeat(this.puntuacion); }

  async enviarPuntuacion() {
    if (!this.comentario.trim()) { this.mensaje = 'Por favor, escribí un comentario.'; return; }
    const { error } = await supabase.from('feedback').insert({
      cantidad_estrellas: this.puntuacion,
      comentario: this.comentario,
    });
    if (error) { console.error(error); this.mensaje = '❌ Error al guardar la puntuación.'; }
    else {
      this.mensaje = `✅ Gracias por tu puntuación de ${this.puntuacion} estrellas`;
      this.comentario = ''; this.puntuacion = 5; this.estrellasVisuales = '⭐⭐⭐⭐⭐';
      await this.cargarFeedbacks();
    }
  }

  async cargarFeedbacks() {
    const { data, error } = await supabase.from('feedback').select('*');
    if (error) console.error(error);
    this.feedbacks = data || [];
  }

  async editarFeedback(feedback: any) {
    const nuevoComentario = prompt('Editar comentario:', feedback.comentario);
    if (nuevoComentario && nuevoComentario.trim() !== '') {
      const { error } = await supabase.from('feedback')
        .update({ comentario: nuevoComentario }).eq('id', feedback.id);
      if (error) console.error(error);
      await this.cargarFeedbacks();
    }
  }

  async eliminarFeedback(id: number) {
    if (confirm('¿Seguro que querés eliminar este feedback?')) {
      const { error } = await supabase.from('feedback').delete().eq('id', id);
      if (error) console.error(error);
      await this.cargarFeedbacks();
    }
  }
}
