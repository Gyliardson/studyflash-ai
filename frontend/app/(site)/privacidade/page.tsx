export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-12 md:px-6 md:py-16 max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight mb-8 text-foreground">Política de Privacidade</h1>
      
      <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 text-muted-foreground">
        <p>
          Esta Política de Privacidade descreve como o StudyFlash coleta, usa e protege suas informações, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
        </p>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">1. Coleta de Dados</h2>
        <p>
          Coletamos apenas os dados necessários para o funcionamento da plataforma:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Informações de conta (fornecidas através do Clerk Auth).</li>
          <li>Arquivos e textos enviados para geração de flashcards.</li>
          <li>Dados de uso e progresso nos estudos.</li>
        </ul>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">2. Uso dos Dados</h2>
        <p>
          Seus dados são utilizados exclusivamente para:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Fornecer o serviço de geração de flashcards.</li>
          <li>Gerenciar sua conta e acesso.</li>
          <li>Melhorar a experiência do usuário na plataforma.</li>
        </ul>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">3. Cookies e Tecnologias de Rastreamento</h2>
        <p>
          Utilizamos cookies essenciais para garantir a segurança e autenticação do usuário.
        </p>
        <div className="p-4 bg-muted/50 border border-border rounded-lg">
          <p className="font-semibold text-foreground mb-2">Cookies Necessários:</p>
          <p>
            O StudyFlash utiliza cookies de sessão e autenticação fornecidos pelo <strong>Clerk</strong>. Estes cookies são estritamente necessários para que você possa fazer login e acessar sua conta de forma segura. Sem estes cookies, a área logada da plataforma não funcionará corretamente.
          </p>
        </div>
        <p className="mt-4">
          Também podemos utilizar cookies de análise (como Vercel Analytics) para entender como a plataforma é utilizada, de forma anônima e agregada, visando melhorias de performance e usabilidade.
        </p>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">4. Seus Direitos (LGPD)</h2>
        <p>
          Como titular dos dados, você tem direito a:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Confirmar a existência de tratamento de dados.</li>
          <li>Acessar seus dados.</li>
          <li>Corrigir dados incompletos ou desatualizados.</li>
          <li>Solicitar a exclusão de seus dados (ao encerrar sua conta).</li>
        </ul>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">5. Contato</h2>
        <p>
          Para exercer seus direitos ou tirar dúvidas sobre esta política, entre em contato conosco através dos canais oficiais de suporte na plataforma.
        </p>
      </div>
    </div>
  );
}
