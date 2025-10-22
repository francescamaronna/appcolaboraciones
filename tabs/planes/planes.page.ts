import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

import { DatabaseService } from '../../services/database';

@Component({
  selector: 'app-planes',
  templateUrl: './planes.page.html',
  styleUrls: ['./planes.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule],
})
export class PlanesPage implements OnInit {
  private readonly TABLE = 'planes_backup';

  planes: any[] = [];
  nuevoPlan: any = { nombre: '', precio: null, activo: true };

  editando = false;
  planEditando: any = null;

  cargando = false;

  constructor(private db: DatabaseService) {}

  async ngOnInit() {
    await this.cargarPlanes();
  }

  async cargarPlanes() {
    this.cargando = true;
    try {
      this.planes = await this.db.getAll(this.TABLE);
    } finally {
      this.cargando = false;
    }
  }

  async agregarPlan() {
    if (!this.nuevoPlan?.nombre?.trim()) return;
    const precioNum = Number(this.nuevoPlan.precio);
    if (isNaN(precioNum) || precioNum < 0) return;

    const record = {
      nombre: this.nuevoPlan.nombre.trim(),
      precio: precioNum,
      activo: !!this.nuevoPlan.activo,
    };

    await this.db.insert(this.TABLE, record);
    this.nuevoPlan = { nombre: '', precio: null, activo: true };
    await this.cargarPlanes();
  }

  editarPlan(plan: any) {
    this.editando = true;
    this.planEditando = { ...plan };
  }

  async guardarEdicion() {
    if (!this.planEditando?.id_plan) return;

    if (!this.planEditando?.nombre?.trim()) return;
    const precioNum = Number(this.planEditando.precio);
    if (isNaN(precioNum) || precioNum < 0) return;

    const patch = {
      nombre: this.planEditando.nombre.trim(),
      precio: precioNum,
      activo: !!this.planEditando.activo,
    };

    // ✅ Se agrega el nombre de la columna del ID
    await this.db.update(this.TABLE, 'id_plan', this.planEditando.id_plan, patch);

    this.editando = false;
    this.planEditando = null;
    await this.cargarPlanes();
  }

  cancelarEdicion() {
    this.editando = false;
    this.planEditando = null;
  }

  async eliminarPlan(id_plan: number) {
    if (!id_plan) return;
    const ok = confirm('¿Eliminar este plan?');
    if (!ok) return;

    // ✅ También se agrega el nombre de la columna del ID
    await this.db.delete(this.TABLE, 'id_plan', id_plan);

    await this.cargarPlanes();
  }
}
