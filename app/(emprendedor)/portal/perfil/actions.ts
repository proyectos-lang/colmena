"use server"

import bcrypt from "bcryptjs"
import { createAdminClient } from "@/lib/supabase/admin"

export async function cambiarPasswordEmprendedor(
  usuarioId: number,
  passwordActual: string,
  passwordNueva: string
): Promise<{ error: string | null }> {
  if (!passwordActual || !passwordNueva) return { error: "Todos los campos son requeridos" }
  if (passwordNueva.length < 6) return { error: "La nueva contraseña debe tener al menos 6 caracteres" }

  const supabase = createAdminClient()
  if (!supabase) return { error: "Error de conexión" }

  const { data, error } = await supabase
    .from("emprendedores_usuarios")
    .select("password_hash")
    .eq("id", usuarioId)
    .single()

  if (error || !data) return { error: "Usuario no encontrado" }

  const match = await bcrypt.compare(passwordActual, data.password_hash)
  if (!match) return { error: "La contraseña actual es incorrecta" }

  const nuevoHash = await bcrypt.hash(passwordNueva, 10)
  const { error: updateError } = await supabase
    .from("emprendedores_usuarios")
    .update({ password_hash: nuevoHash })
    .eq("id", usuarioId)

  return { error: updateError?.message ?? null }
}
