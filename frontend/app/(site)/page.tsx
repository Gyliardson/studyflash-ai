import Link from "next/link";
import { ArrowRight, BookOpenCheck, BrainCircuit, FileText, Layers3, ShieldCheck } from "lucide-react";

const workflow = [
  {
    title: "Transforme seu material",
    description: "Cole um texto ou envie um PDF para gerar flashcards que você pode revisar antes de salvar.",
    icon: FileText,
  },
  {
    title: "Organize em decks",
    description: "Mantenha seus cards em uma coleção persistente e escolha exatamente o que entra em cada sessão.",
    icon: Layers3,
  },
  {
    title: "Estude e pratique",
    description: "Revise com repetição espaçada e use simulados com resultado e progresso persistidos pelo servidor.",
    icon: BookOpenCheck,
  },
];

const productProof = [
  "Geração assistida por IA com revisão antes de salvar",
  "Sessões de estudo retomáveis e confirmação de revisão antes de avançar",
  "Simulados com pontuação e XP calculados de forma server-authoritative",
  "PWA instalável com fallback offline seguro, sem cache de dados da conta",
];

export default function LandingPage() {
  return (
    <div className="w-full overflow-hidden">
      <section className="border-b border-border/60 bg-background">
        <div className="container mx-auto grid min-h-[68vh] max-w-6xl items-center gap-12 px-4 py-16 md:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:py-24">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
              <BrainCircuit className="h-4 w-4 text-primary" aria-hidden="true" />
              IA para preparar o material. Você continua no controle do estudo.
            </div>
            <h1 className="text-balance text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Do material bruto à revisão, em um fluxo de estudo só.
            </h1>
            <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground md:text-xl">
              O StudyFlash transforma textos e PDFs em flashcards revisáveis, organiza seus decks e conecta estudo espaçado, simulados e progresso sem esconder quando uma operação ainda não foi salva.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Criar material de estudo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="#como-funciona"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-card px-6 text-sm font-bold text-foreground shadow-sm transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Ver como funciona
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Conteúdo gerado por IA pode conter erros. Revise os cards antes de usá-los como material de aprendizagem.
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-xl shadow-black/5 md:p-7">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Fluxo StudyFlash</p>
                <h2 className="mt-1 text-xl font-bold text-card-foreground">Da fonte à prática</h2>
              </div>
              <ShieldCheck className="h-7 w-7 text-primary" aria-hidden="true" />
            </div>
            <div className="mt-5 space-y-3">
              {productProof.map((item, index) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-border/70 bg-background/70 p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-extrabold text-primary">
                    {index + 1}
                  </span>
                  <p className="text-sm font-medium leading-6 text-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="bg-muted/35 py-16 md:py-24">
        <div className="container mx-auto max-w-6xl px-4 md:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Como funciona</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
              Um caminho claro entre criar, organizar e praticar.
            </h2>
            <p className="mt-4 text-lg leading-8 text-muted-foreground">
              Cada etapa tem uma função explícita: a IA acelera a preparação, enquanto coleção, estudo e simulados mantêm o trabalho revisável e persistente.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {workflow.map(({ title, description, icon: Icon }, index) => (
              <article key={title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-extrabold text-muted-foreground">0{index + 1}</span>
                </div>
                <h3 className="mt-6 text-xl font-bold text-card-foreground">{title}</h3>
                <p className="mt-3 leading-7 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-background py-14 md:py-18">
        <div className="container mx-auto flex max-w-6xl flex-col gap-6 px-4 md:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">Comece pelo material que você já tem.</h2>
            <p className="mt-2 text-muted-foreground">Abra o ambiente de criação, gere uma primeira versão e revise antes de adicionar os cards à sua coleção.</p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Abrir StudyFlash
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
