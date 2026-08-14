import Link from "next/link";

export const metadata = {
  title: "Sem conexão | StudyFlash",
};

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground flex items-center justify-center">
      <section className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 text-center shadow-xl" aria-labelledby="offline-title">
        <p className="mb-3 text-sm font-bold uppercase tracking-widest text-primary">StudyFlash offline</p>
        <h1 id="offline-title" className="text-3xl font-black tracking-tight text-card-foreground">
          Você está sem conexão
        </h1>
        <p className="mt-4 text-muted-foreground">
          Por segurança, conteúdos da sua conta, revisões, simulados, geração por IA e alterações de baralhos não são servidos de um cache autenticado antigo.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Reconecte-se e tente novamente. A aplicação recarrega ao recuperar a rede para buscar o estado confirmado pelo servidor.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-xl bg-primary px-6 py-3 font-bold text-primary-foreground shadow-md transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Tentar página inicial
        </Link>
      </section>
    </main>
  );
}
