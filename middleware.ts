import { type NextRequest, NextResponse } from "next/server"

const EMP_COOKIE = "emp_session"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas del portal emprendedor — verificar que la cookie de sesión exista
  if (pathname.startsWith("/portal/")) {
    const token = request.cookies.get(EMP_COOKIE)?.value
    if (!token) {
      return NextResponse.redirect(new URL("/login-emprendedor", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/portal/:path*"],
}
