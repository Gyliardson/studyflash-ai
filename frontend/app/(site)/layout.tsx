import Link from "next/link";
import CookieBanner from "@/app/components/CookieBanner";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Link
            className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="/"
            aria-label="StudyFlash — início"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-xs font-black text-primary-foreground" aria-hidden="true">SF</span>
            <span className="text-lg font-extrabold tracking-tight text-foreground">
              Study<span className="text-primary">Flash</span>
            </span>
          </Link>

          <nav className="flex items-center gap-2" aria-label="Navegação principal">
            <Link
              href="/#como-funciona"
              className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
            >
              Como funciona
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Abrir StudyFlash
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-card/40 py-8">
        <div className="container mx-auto flex max-w-6xl flex-col gap-5 px-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
          <p>
            © {new Date().getFullYear()} StudyFlash · Desenvolvido por <span className="font-semibold text-foreground">Gyliardson Keitison</span>
          </p>
          <nav aria-label="Links institucionais" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/termos" className="font-medium transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Termos</Link>
            <Link href="/privacidade" className="font-medium transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Privacidade</Link>
            <a href="mailto:gyliardson@outlook.com" className="font-medium transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Contato</a>
          </nav>
        </div>
      </footer>

      <CookieBanner />
    </div>
  );
}
