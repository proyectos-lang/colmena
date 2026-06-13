import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { getEmprendedorSession } from "@/app/login-emprendedor/actions"
import { EmprendedorAuthProvider } from "@/lib/contexts/emprendedor-auth-context"
import { EmprendedorShell } from "./emprendedor-shell"

export default async function EmprendedorLayout({ children }: { children: ReactNode }) {
  const session = await getEmprendedorSession()
  if (!session) redirect("/login-emprendedor")

  return (
    <EmprendedorAuthProvider initialSession={session}>
      <EmprendedorShell>{children}</EmprendedorShell>
    </EmprendedorAuthProvider>
  )
}
