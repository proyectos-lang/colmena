"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { loginEmprendedor, logoutEmprendedor, validateSessionToken } from "@/lib/services/emprendedores-auth"
import { createAdminClient } from "@/lib/supabase/admin"

const COOKIE_NAME = "emp_session"
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60

export async function loginAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const usuario = String(formData.get("usuario") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!usuario || !password) {
    return { error: "Usuario y contraseña son requeridos" }
  }

  const { session, error } = await loginEmprendedor(usuario, password)
  if (error || !session) {
    return { error: error ?? "Error al iniciar sesión" }
  }

  // Recuperar el token que se guardó en DB para este usuario
  const supabase = createAdminClient()
  const token = supabase
    ? (await supabase
        .from("emprendedores_usuarios")
        .select("session_token")
        .eq("id", session.id)
        .single()
      ).data?.session_token ?? ""
    : ""

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
  })

  redirect("/portal/mis-productos")
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value ?? ""
  if (token) await logoutEmprendedor(token)
  cookieStore.delete(COOKIE_NAME)
  redirect("/login-emprendedor")
}

export async function getEmprendedorSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value ?? ""
  if (!token) return null
  return validateSessionToken(token)
}
