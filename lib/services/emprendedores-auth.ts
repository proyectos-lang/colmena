"use server"

import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { createAdminClient } from "@/lib/supabase/admin"

export interface EmprendedorSession {
  id: number
  emprendimientoId: number
  emprendimientoNombre: string
  razonSocialId: number
  nombre: string
  usuario: string
}

export interface EmprendedorUsuario {
  id: number
  emprendimiento_id: number
  nombre: string
  usuario: string
  activo: boolean
  created_at: string
}

const TOKEN_DAYS = 7

export async function createEmprendedorUsuario(
  emprendimientoId: number,
  nombre: string,
  usuario: string,
  plainPassword: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { error: "Cliente admin no disponible" }

  const passwordHash = await bcrypt.hash(plainPassword, 10)

  const { error } = await supabase
    .from("emprendedores_usuarios")
    .insert({ emprendimiento_id: emprendimientoId, nombre, usuario, password_hash: passwordHash })

  if (error) {
    if (error.code === "23505") return { error: "El nombre de usuario ya está en uso" }
    return { error: error.message }
  }
  return { error: null }
}

export async function changePassword(
  usuarioId: number,
  newPlainPassword: string
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { error: "Cliente admin no disponible" }

  const passwordHash = await bcrypt.hash(newPlainPassword, 10)

  const { error } = await supabase
    .from("emprendedores_usuarios")
    .update({ password_hash: passwordHash, session_token: null, token_expires_at: null })
    .eq("id", usuarioId)

  return { error: error?.message ?? null }
}

export async function loginEmprendedor(
  usuario: string,
  plainPassword: string
): Promise<{ session: EmprendedorSession | null; error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { session: null, error: "Cliente no disponible" }

  const { data, error } = await supabase
    .from("emprendedores_usuarios")
    .select("id, emprendimiento_id, nombre, usuario, password_hash, activo, emprendimientos(nombre, razon_social_id)")
    .eq("usuario", usuario)
    .single()

  if (error || !data) return { session: null, error: "Usuario o contraseña incorrectos" }
  if (!data.activo) return { session: null, error: "Tu cuenta está inactiva" }

  const match = await bcrypt.compare(plainPassword, data.password_hash)
  if (!match) return { session: null, error: "Usuario o contraseña incorrectos" }

  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { error: updateError } = await supabase
    .from("emprendedores_usuarios")
    .update({ session_token: token, token_expires_at: expiresAt })
    .eq("id", data.id)

  if (updateError) return { session: null, error: "Error al crear sesión" }

  const emp: any = Array.isArray(data.emprendimientos) ? data.emprendimientos[0] : data.emprendimientos

  return {
    session: {
      id: data.id,
      emprendimientoId: data.emprendimiento_id,
      emprendimientoNombre: emp?.nombre ?? "",
      razonSocialId: emp?.razon_social_id ?? 1,
      nombre: data.nombre,
      usuario: data.usuario,
    },
    error: null,
  }
}

export async function validateSessionToken(
  token: string
): Promise<EmprendedorSession | null> {
  if (!token) return null
  const supabase = createAdminClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from("emprendedores_usuarios")
    .select("id, emprendimiento_id, nombre, usuario, activo, token_expires_at, emprendimientos(nombre, razon_social_id)")
    .eq("session_token", token)
    .single()

  if (error || !data || !data.activo) return null
  if (!data.token_expires_at || new Date(data.token_expires_at) < new Date()) return null

  const emp: any = Array.isArray(data.emprendimientos) ? data.emprendimientos[0] : data.emprendimientos

  return {
    id: data.id,
    emprendimientoId: data.emprendimiento_id,
    emprendimientoNombre: emp?.nombre ?? "",
    razonSocialId: emp?.razon_social_id ?? 1,
    nombre: data.nombre,
    usuario: data.usuario,
  }
}

export async function logoutEmprendedor(token: string): Promise<void> {
  if (!token) return
  const supabase = createAdminClient()
  if (!supabase) return
  await supabase
    .from("emprendedores_usuarios")
    .update({ session_token: null, token_expires_at: null })
    .eq("session_token", token)
}

export async function getUsuariosByEmprendimiento(
  emprendimientoId: number
): Promise<EmprendedorUsuario[]> {
  const supabase = createAdminClient()
  if (!supabase) return []

  const { data } = await supabase
    .from("emprendedores_usuarios")
    .select("id, emprendimiento_id, nombre, usuario, activo, created_at")
    .eq("emprendimiento_id", emprendimientoId)
    .order("created_at", { ascending: true })

  return data ?? []
}

export async function toggleEmprendedorUsuarioActivo(
  id: number,
  activo: boolean
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { error: "Cliente admin no disponible" }
  const { error } = await supabase
    .from("emprendedores_usuarios")
    .update({ activo })
    .eq("id", id)
  return { error: error?.message ?? null }
}

export async function deleteEmprendedorUsuario(id: number): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { error: "Cliente admin no disponible" }
  const { error } = await supabase
    .from("emprendedores_usuarios")
    .delete()
    .eq("id", id)
  return { error: error?.message ?? null }
}
