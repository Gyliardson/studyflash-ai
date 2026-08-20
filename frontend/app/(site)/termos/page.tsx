export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-12 md:px-6 md:py-16 max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight mb-8 text-foreground">Termos de Uso</h1>

      <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 text-muted-foreground">
        <p>
          Bem-vindo ao StudyFlash. Ao acessar e usar nossa plataforma, você concorda com estes termos.
        </p>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">1. Serviços Oferecidos</h2>
        <p>
          O StudyFlash é uma plataforma de estudos com funcionalidades assistidas por Inteligência Artificial. As superfícies de geração incluem flashcards, planos de estudo, cards de tópicos e alternativas para simulados.
        </p>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">2. Responsabilidade sobre Conteúdo Gerado por IA</h2>
        <div className="p-4 bg-muted/50 border border-border rounded-lg">
          <p className="font-semibold text-foreground mb-2">Aviso Importante sobre Inteligência Artificial:</p>
          <p>
            O usuário reconhece que conteúdo gerado por modelos de linguagem pode conter erros, imprecisões ou &ldquo;alucinações&rdquo;. O StudyFlash atua como ferramenta de auxílio e não substitui a consulta às fontes originais.
            <strong> O usuário deve verificar a veracidade e a exatidão do material gerado antes de utilizá-lo para fins acadêmicos ou profissionais.</strong>
          </p>
        </div>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">3. Processamento por Provedor Externo</h2>
        <p>
          Para executar funcionalidades de IA, o StudyFlash pode encaminhar a um provedor externo de inferência o conteúdo necessário para produzir a resposta. O provedor atualmente integrado ao backend é a <strong>Groq</strong>.
        </p>
        <p>
          Dependendo da funcionalidade, esse processamento pode envolver texto de estudo, texto extraído de PDF, tópico e dificuldade de um plano, títulos de curso/plano e tópico, ou a pergunta e a resposta correta de um flashcard para gerar alternativas de simulado. No fluxo atual de PDF, o backend extrai o texto e envia o texto necessário à geração; o arquivo PDF binário bruto não é enviado ao provedor pelo código atual.
        </p>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">4. Inferência e Treinamento de Modelos</h2>
        <p>
          Processar conteúdo em um serviço externo para gerar uma resposta é diferente de usar esse conteúdo para treinamento ou fine-tuning de modelos. Estes termos descrevem o fluxo de inferência implementado pelo StudyFlash e não transformam uma afirmação sobre treinamento em uma afirmação de que dados nunca são enviados a terceiros.
        </p>
        <p>
          O repositório atual não fornece base para prometer Zero Data Retention, ausência total de logs do provedor ou retenção zero no lado do provedor.
        </p>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">5. Propriedade Intelectual e Dados</h2>
        <p>
          O usuário mantém os direitos que possua sobre os arquivos e textos originais enviados à plataforma. Ao utilizar uma funcionalidade de geração, autoriza o processamento técnico do conteúdo necessário para executar a solicitação, inclusive pelo provedor externo de inferência quando aplicável.
        </p>
        <p>
          Estes termos de uso da aplicação não alteram a licença do código-fonte do repositório StudyFlash. O repositório permanece sujeito aos termos proprietários definidos em seu arquivo <code>LICENSE</code>.
        </p>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">6. Limitação de Responsabilidade</h2>
        <p>
          O StudyFlash não se responsabiliza por resultados em provas, concursos ou exames obtidos com o auxílio da plataforma. O conteúdo assistido por IA deve ser revisado pelo usuário antes de servir como fonte de decisão ou estudo.
        </p>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">7. Alterações nos Termos</h2>
        <p>
          Estes termos podem ser atualizados quando a plataforma, suas integrações ou suas práticas mudarem. A versão publicada na aplicação representa os termos vigentes apresentados ao usuário.
        </p>
      </div>
    </div>
  );
}
