export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-12 md:px-6 md:py-16 max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight mb-8 text-foreground">Política de Privacidade</h1>

      <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 text-muted-foreground">
        <p>
          Esta página descreve as práticas técnicas de tratamento de dados observáveis no StudyFlash. Ela apresenta como a aplicação funciona hoje e não constitui uma certificação absoluta de conformidade jurídica.
        </p>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">1. Dados utilizados pela plataforma</h2>
        <p>
          O StudyFlash trata dados necessários para oferecer as funcionalidades solicitadas pelo usuário, incluindo:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Informações de conta e sessão gerenciadas por meio do Clerk.</li>
          <li>Textos e arquivos enviados para criação de material de estudo.</li>
          <li>Tópicos, dificuldade e conteúdo de flashcards usados nas funcionalidades de geração.</li>
          <li>Dados de uso e progresso necessários às funções de estudo da plataforma.</li>
        </ul>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">2. Processamento por IA</h2>
        <p>
          Algumas funcionalidades utilizam um provedor externo de inferência. O provedor atualmente integrado ao backend do StudyFlash é a <strong>Groq</strong>.
        </p>
        <p>
          Para produzir uma resposta, o backend pode enviar ao provedor apenas o material necessário à funcionalidade solicitada. Isso pode incluir texto de estudo, tópico e dificuldade de um plano, título de curso/plano e tópico para cards, ou a pergunta e a resposta correta de um flashcard para gerar alternativas de simulado.
        </p>
        <div className="p-4 bg-muted/50 border border-border rounded-lg">
          <p className="font-semibold text-foreground mb-2">Geração a partir de PDF:</p>
          <p>
            O arquivo PDF é recebido e processado no backend do StudyFlash. O texto é extraído com PyMuPDF e somente o texto extraído necessário à geração, dentro dos limites da aplicação, é enviado ao provedor de IA pelo fluxo atual. O código atual não envia o arquivo PDF binário bruto à Groq.
          </p>
        </div>
        <p>
          Processamento por um provedor externo para inferência e treinamento ou fine-tuning de modelos são atividades diferentes. O repositório demonstra o fluxo de inferência implementado pela aplicação, mas não fornece evidência suficiente para prometer Zero Data Retention, ausência total de logs no provedor ou retenção zero do lado do provedor.
        </p>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">3. Cookies e Web Analytics</h2>
        <div className="p-4 bg-muted/50 border border-border rounded-lg">
          <p className="font-semibold text-foreground mb-2">Autenticação com Clerk:</p>
          <p>
            O StudyFlash utiliza o Clerk para autenticação. O Clerk usa cookies necessários ao funcionamento de sessões e autenticação; bloqueá-los pode impedir o acesso correto à área autenticada.
          </p>
        </div>
        <p className="mt-4">
          O StudyFlash também inclui a integração do Vercel Web Analytics. Quando o recurso está habilitado e configurado no ambiente de deployment, o Web Analytics da Vercel opera sem cookies de analytics e utiliza dados agregados conforme o comportamento documentado do serviço. A preferência local exibida pelo aviso da aplicação não ativa, desativa ou controla o Clerk nem o Vercel Web Analytics.
        </p>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">4. Solicitações sobre dados</h2>
        <p>
          Você pode entrar em contato pelos canais oficiais de suporte da plataforma para solicitar informações sobre o tratamento aplicável à sua conta, correções ou exclusão de dados quando cabível. Esta página não promete exclusão automática de conta ou de todos os dados, pois essa automação não é comprovada pelo repositório atual.
        </p>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">5. Contato</h2>
        <p>
          Para dúvidas sobre esta política ou solicitações relacionadas aos seus dados, utilize os canais oficiais de suporte disponibilizados na plataforma.
        </p>
      </div>
    </div>
  );
}
