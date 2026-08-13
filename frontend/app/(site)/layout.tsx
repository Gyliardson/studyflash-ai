import Link from "next/link";
import CookieBanner from "@/app/components/CookieBanner";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center px-4 md:px-8">
          <div className="mr-4 hidden md:flex">
            <Link className="mr-6 flex items-center space-x-2" href="/">
              <span className="hidden text-xl font-bold text-primary sm:inline-block">
                StudyFlash
              </span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none" />
            <nav className="flex items-center" aria-label="Navegação principal">
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Abrir StudyFlash
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="py-6 md:px-8 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="mb-4">
            © {new Date().getFullYear()} StudyFlash • Desenvolvido por{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Gyliardson Keitison
            </span>
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/termos"
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
            >
              Termos de Uso
            </Link>
            <Link
              href="/privacidade"
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
            >
              Privacidade
            </Link>
            <a
              href="mailto:gyliardson@outlook.com"
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
            >
              Contato
            </a>
          </div>
        </div>
      </footer>

      <CookieBanner />
    </div>
  );
}
