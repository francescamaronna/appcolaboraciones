import { Injectable } from '@angular/core';
import { supabase } from '../supabase';

@Injectable({ providedIn: 'root' })
export class Auth {
  // --- Login manual ---
  async login(email: string, password: string) {
    return await supabase.auth.signInWithPassword({ email, password });
  }

  // --- Registro manual (email/clave) ---
  async register(email: string, password: string) {
    return await supabase.auth.signUp({ email, password });
  }

  // --- Google OAuth ---
  async loginWithGoogle(redirectTo?: string) {
    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo ?? (window.location.origin + '/oauth') }
    });
  }

  // --- Sesión/usuario actual ---
  getCurrentSession() {
    return supabase.auth.getSession();
  }
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  // --- Cerrar sesión ---
  logout() {
    return supabase.auth.signOut();
  }

  /**
   * Crea fila en public.usuario si no existe (clave para Alta de colaborador).
   * Idempotente: si ya existe, no hace nada.
   */
  async ensureUsuario(authUserId: string, fallbackEmail?: string) {
  // ¿Existe ya?
  const { data: existing } = await supabase
    .from('usuario')
    .select('id_usuario')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (existing) return existing;

  const { data: { user } } = await supabase.auth.getUser();

  // Tipar user_metadata de forma segura
  type Meta = { name?: string; avatar_url?: string };
  const meta: Meta = (user?.user_metadata ?? {}) as Meta;

  const nombreMeta = (meta.name ?? '').toString().trim();
  const nombre = nombreMeta || (user?.email?.split('@')[0] ?? 'Usuario');

  const insert = {
    auth_user_id: authUserId,
    nombre,
    apellido: '',
    email: user?.email ?? fallbackEmail ?? '',
    contrasena: null as any, // usamos Supabase Auth (si tu columna es NOT NULL, relajala en SQL)
    pais: null as any,
    zona_horaria: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    avatar_url: meta.avatar_url ?? null
  };

  const { data, error } = await supabase
    .from('usuario')
    .insert(insert)
    .select('id_usuario')
    .single();

  if (error) throw error;
  return data;
}

}