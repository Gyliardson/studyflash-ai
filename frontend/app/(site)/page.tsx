import Link from "next/link";

const primaryCtaClasses =
  "inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const secondaryCtaClasses =
  "inline-flex h-12 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center">
      <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-background">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none text-foreground">
                Estude Mais Rápido com Flashcards de IA
              </h1>
              <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                Transforme seus PDFs e textos em flashcards inteligentes instantaneamente. Otimize seu aprendizado com StudyFlash.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/dashboard" className={primaryCtaClasses}>
                Começar Agora
              </Link>
              <Link href="#features" className={secondaryCtaClasses}>
                Saiba Mais
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-muted/50" aria-labelledby="features-heading">
        <div className="container mx-auto px-4 md:px-6">
          <h2 id="features-heading" className="sr-only">Recursos do StudyFlash</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-12">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10" aria-hidden="true">
                <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-foreground">Geração Instantânea</h3>
              <p className="text-muted-foreground">Crie decks completos em segundos a partir de qualquer material de estudo.</p>
            </div>
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10" aria-hidden="true">
                <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-foreground">Foco no Conteúdo</h3>
              <p className="text-muted-foreground">A IA extrai os pontos chave para você não perder tempo resumindo.</p>
            </div>
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10" aria-hidden="true">
                <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-foreground">Estude em Qualquer Lugar</h3>
              <p className="text-muted-foreground">Acesse seus flashcards no computador ou celular com sincronização automática.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full py-12 md:py-24 lg:py-32 bg-background" aria-labelledby="testimonials-heading">
        <div className="container mx-auto px-4 md:px-6">
          <h2 id="testimonials-heading" className="text-3xl font-bold tracking-tighter sm:text-4xl text-center mb-12 text-foreground">
            Quem usa recomenda
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-12">
            <div className="flex flex-col p-6 space-y-4 rounded-xl border border-border bg-card shadow-sm">
              <p className="text-muted-foreground italic">&quot;O StudyFlash salvou meu semestre! Consegui resumir livros inteiros em flashcards em minutos.&quot;</p>
              <div className="flex items-center space-x-4">
                <div className="h-10 w-10 rounded-full bg-secondary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-card-foreground">Ana Paula Costa</p>
                  <p className="text-xs text-muted-foreground">Estudante de Medicina</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col p-6 space-y-4 rounded-xl border border-border bg-card shadow-sm">
              <p className="text-muted-foreground italic">&quot;Incrível para revisar para concursos. A qualidade dos cards gerados é surpreendente.&quot;</p>
              <div className="flex items-center space-x-4">
                <div className="h-10 w-10 rounded-full bg-secondary" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-card-foreground">Lucas Rodrigues</p>
                  <p className="text-xs text-muted-foreground">Concurseiro</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
