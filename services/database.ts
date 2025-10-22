import { Injectable } from '@angular/core';
import { supabase } from '../supabase'; // usamos tu cliente ya creado

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  // Obtener todas las filas de una tabla
  async getAll(table: string) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) throw error;
    return data || [];
  }

  // Insertar una fila
  async insert(table: string, record: any) {
    const { data, error } = await supabase.from(table).insert([record]);
    if (error) throw error;
    return data;
  }

  // Actualizar por id
  async update(table: string, idColumn: string, idValue: any, record: any) {
    const { data, error } = await supabase.from(table).update(record).eq(idColumn, idValue);
    if (error) throw error;
    return data;
  }

  // Eliminar por id
  async delete(table: string, idColumn: string, idValue: any) {
    const { error } = await supabase.from(table).delete().eq(idColumn, idValue);
    if (error) throw error;
  }
}