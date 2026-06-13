"use server"

import { createAdminClient } from "@/lib/supabase/admin"

export interface MarcaAdmin {
  id: number
  nombre: string
}

export interface CategoriaAdmin {
  id: number
  nombre: string
}

export interface SubcategoriaAdmin {
  id: number
  nombre: string
  categoria_id: number
}

export async function getMarcasByRazonSocial(razonSocialId: number): Promise<MarcaAdmin[]> {
  const supabase = createAdminClient()
  if (!supabase) return []
  const { data } = await supabase
    .from("marcas")
    .select("id, nombre")
    .eq("razon_social_id", razonSocialId)
    .order("nombre")
  return data ?? []
}

export async function createMarcaAdmin(
  nombre: string,
  razonSocialId: number
): Promise<{ data: MarcaAdmin | null; error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { data: null, error: "Cliente no disponible" }
  const { data, error } = await supabase
    .from("marcas")
    .insert({ nombre: nombre.trim(), razon_social_id: razonSocialId })
    .select("id, nombre")
    .single()
  return { data, error: error?.message ?? null }
}

export async function getCategoriasByRazonSocial(razonSocialId: number): Promise<CategoriaAdmin[]> {
  const supabase = createAdminClient()
  if (!supabase) return []
  const { data } = await supabase
    .from("categorias")
    .select("id, nombre")
    .eq("razon_social_id", razonSocialId)
    .order("nombre")
  return data ?? []
}

export async function createCategoriaAdmin(
  nombre: string,
  razonSocialId: number
): Promise<{ data: CategoriaAdmin | null; error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { data: null, error: "Cliente no disponible" }
  const { data, error } = await supabase
    .from("categorias")
    .insert({ nombre: nombre.trim(), razon_social_id: razonSocialId })
    .select("id, nombre")
    .single()
  return { data, error: error?.message ?? null }
}

export async function getSubcategoriasByCategoria(categoriaId: number): Promise<SubcategoriaAdmin[]> {
  const supabase = createAdminClient()
  if (!supabase) return []
  const { data } = await supabase
    .from("subcategorias")
    .select("id, nombre, categoria_id")
    .eq("categoria_id", categoriaId)
    .order("nombre")
  return data ?? []
}

export async function createSubcategoriaAdmin(
  nombre: string,
  categoriaId: number,
  razonSocialId: number
): Promise<{ data: SubcategoriaAdmin | null; error: string | null }> {
  const supabase = createAdminClient()
  if (!supabase) return { data: null, error: "Cliente no disponible" }
  const { data, error } = await supabase
    .from("subcategorias")
    .insert({ nombre: nombre.trim(), categoria_id: categoriaId, razon_social_id: razonSocialId })
    .select("id, nombre, categoria_id")
    .single()
  return { data, error: error?.message ?? null }
}
