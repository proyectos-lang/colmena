"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from "lucide-react"
import { useAuth } from "@/lib/contexts/auth-context"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

// Brand palette
// Ink Black:  #0D1821
// Yale Blue:  #344966
// Sky Blue:   #abcde0
// Porcelain:  #F0F4EF
// Dry Sage:   #BFCC94

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { login, user, loading } = useAuth()

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)

  // Si ya esta logueado, redirigir al modulo de Inicio
  React.useEffect(() => {
    if (!loading && user) {
      router.replace("/")
    }
  }, [user, loading, router])

  // Evitar flash de la pantalla de login mientras se restaura la sesion
  if (loading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#344966" }}>
        <div className="flex flex-col items-center gap-4">
          <span className="text-3xl font-bold tracking-tight">
            <span className="text-white">Easy</span>
            <span style={{ color: "#abcde0" }}>Count</span>
          </span>
          <div className="flex items-center gap-2" style={{ color: "#abcde0" }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Cargando...</span>
          </div>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      toast({
        title: "EasyCount",
        description: "Por favor ingresa email y contraseña",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    const { error } = await login(email, password)
    setSubmitting(false)

    if (error) {
      toast({
        title: "EasyCount: error de autenticación",
        description: error,
        variant: "destructive",
      })
      return
    }

    toast({
      title: "EasyCount",
        description: "Sesión iniciada correctamente",
    })
    router.replace("/")
  }

  return (
    <main
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{
        backgroundImage: `url('https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_5385-1v02bKvtjuY9N5MFzK8Mc65DTNkmN4.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <style>{`
        @keyframes fadeSlideLeft {
          from { opacity: 0; transform: translateX(-32px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .anim-slide-left {
          animation: fadeSlideLeft 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .anim-slide-up-1 {
          animation: fadeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.2s both;
        }
        .anim-slide-up-2 {
          animation: fadeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.4s both;
        }
        .anim-fade-in {
          animation: fadeIn 0.8s ease 0.6s both;
        }
        .anim-card {
          animation: fadeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.15s both;
        }
        .login-input:focus-visible {
          outline: none;
          border-color: #BFCC94 !important;
          box-shadow: 0 0 0 3px rgba(191, 204, 148, 0.35) !important;
        }
      `}</style>
      {/* Contenido: dos columnas en desktop, una en mobile */}
      <div className="relative z-10 flex flex-1 items-center px-4 py-6 sm:py-10 lg:py-12 lg:px-12">
        <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-16 mx-auto">

          {/* ── Panel izquierdo: texto de marca ── */}
          <div className="hidden lg:flex flex-col gap-6 max-w-lg lg:pl-4">
            <h1
              className="anim-slide-left text-4xl xl:text-5xl font-bold leading-tight tracking-tight text-balance"
              style={{ color: "#344966" }}
            >
              Gestiona tu empresa de forma simple e inteligente
            </h1>
            <p
              className="anim-slide-up-1 text-base leading-relaxed text-pretty"
              style={{ color: "#344966", opacity: 0.85 }}
            >
              Controla tus productos, ventas y finanzas desde un solo lugar. El ERP contable y administrativo diseñado para crecer contigo.
            </p>
            <div className="anim-slide-up-2 h-1 w-16 rounded-full" style={{ backgroundColor: "#344966", opacity: 0.4 }} />
          </div>

        <div className="anim-card w-full max-w-sm">

          {/* Card formulario — fondo blanco puro */}
          <div className="rounded-2xl bg-white p-6 sm:p-8 shadow-2xl">

            {/* Logo + cabecera */}
            <div className="mb-5 space-y-2">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/IMG_5365-c5fxbRQfBGwK1uj6MpIRuiHtoWnfdE.jpeg"
                alt="EasyCount"
                className="w-full h-auto object-contain mx-auto block"
                style={{ maxHeight: "64px" }}
              />
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0D1821" }}>
                  Inicio de sesión
                </h1>
                <p className="text-sm leading-relaxed" style={{ color: "#344966" }}>
                  Ingresa tus credenciales para continuar
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium" style={{ color: "#0D1821" }}>
                  Correo electrónico
                </Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4"
                    style={{ color: "#344966", opacity: 0.5 }}
                  />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="tu@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    className="login-input h-11 pl-10 rounded-xl bg-white text-sm"
                    style={{ borderColor: "#abcde0", color: "#0D1821" }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium" style={{ color: "#0D1821" }}>
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4"
                    style={{ color: "#344966", opacity: 0.5 }}
                  />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    className="login-input h-11 pl-10 pr-10 rounded-xl bg-white text-sm"
                    style={{ borderColor: "#abcde0", color: "#0D1821" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 focus:outline-none"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? (
                      <Eye className="h-4 w-4" style={{ color: "#344966", opacity: 0.5 }} />
                    ) : (
                      <EyeOff className="h-4 w-4" style={{ color: "#344966", opacity: 0.5 }} />
                    )}
                  </button>
                </div>
              </div>

              {/* CTA — azul oscuro (Yale Blue → Ink Black en hover) */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-white transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#344966" }}
                onMouseEnter={(e) => {
                  if (!submitting)
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#0D1821"
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#344966"
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  <>
                    Ingresar
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Nota al pie */}
            <div className="mt-4 pt-4 border-t" style={{ borderColor: "#abcde0" }}>
              <p className="text-xs text-center leading-relaxed" style={{ color: "#344966", opacity: 0.7 }}>
                {"Si olvidaste tu contraseña, contacta al administrador de tu empresa."}
              </p>
            </div>
          </div>

          {/* Copyright */}
          <p className="mt-5 text-center text-xs font-medium" style={{ color: "#344966" }}>
            {new Date().getFullYear()} EasyCount. Todos los derechos reservados.
          </p>
        </div>

        </div>
      </div>
    </main>
  )
}
