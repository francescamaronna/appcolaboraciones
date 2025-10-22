import { Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { supabase } from 'src/app/supabase';

type Solicitud = {
  id: number;
  id_usuario: number;
  created_at: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  user?: { id_usuario: number; nombre: string } | null;
};

@Component({
  standalone: true,
  selector: 'app-solicitudes',
  template: `
    <ion-list *ngIf="solicitudes.length; else vacio">
      <ion-item *ngFor="let s of solicitudes">
        <ion-label>
          <h2>{{ s.user?.nombre || ('Usuario ' + s.id_usuario) }}</h2>
          <p class="muted">Enviada: {{ s.created_at | date:'short' }}</p>
        </ion-label>

        <ion-buttons slot="end">
          <ion-button size="small" color="success" (click)="aprobar.emit(s.id)">
            Aprobar
          </ion-button>
          <ion-button size="small" color="medium" (click)="rechazar.emit(s.id)">
            Rechazar
          </ion-button>
        </ion-buttons>
      </ion-item>
    </ion-list>

    <ng-template #vacio>
      <div class="muted">No hay pendientes.</div>
    </ng-template>
  `,
  styles: [`
    .muted {
      color: var(--ion-color-medium);
    }
  `],
  imports: [CommonModule, IonicModule],
})
export class SolicitudesComponent implements OnInit, OnChanges {
  @Input() idProyecto?: number;
  @Output() aprobar = new EventEmitter<number>();
  @Output() rechazar = new EventEmitter<number>();

  solicitudes: Solicitud[] = [];

  ngOnInit() {
    this.cargar();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['idProyecto']) this.cargar();
  }

  private async cargar() {
    if (!this.idProyecto) {
      this.solicitudes = [];
      return;
    }

    const { data, error } = await supabase
      .from('solicitud_colaborador')
      .select('id, id_usuario, created_at, estado, user:usuario!inner(id_usuario, nombre)')
      .eq('id_proyecto', this.idProyecto)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Solicitudes] load error:', error);
      this.solicitudes = [];
      return;
    }

 this.solicitudes = (data ?? []) as any[]; 
}
}