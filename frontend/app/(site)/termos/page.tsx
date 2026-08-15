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
          O StudyFlash é uma plataforma que utiliza Inteligência Artificial para gerar flashcards e materiais de estudo a partir de textos e arquivos fornecidos pelo usuário.
        </p>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">2. Responsabilidade sobre Conteúdo Gerado por IA</h2>
        <div className="p-4 bg-muted/50 border border-border rounded-lg">
          <p className="font-semibold text-foreground mb-2">Aviso Importante sobre Inteligência Artificial:</p>
          <p>
            O usuário reconhece que o conteúdo gerado pela nossa Inteligência Artificial (LLM) pode conter erros, imprecisões ou &ldquo;alucinações&rdquo;. O StudyFlash atua como uma ferramenta de auxílio e não substitui o estudo direto das fontes originais. 
            <strong> É de responsabilidade exclusiva do usuário verificar a veracidade e exatidão de todo o material gerado antes de utilizá-lo para fins acadêmicos ou profissionais.</strong>
          </p>
        </div>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">3. Propriedade Intelectual e Dados</h2>
        <p>
          O usuário mantém a propriedade sobre os arquivos originais (PDFs, textos) enviados para a plataforma. Ao enviar arquivos, você concede ao StudyFlash uma licença temporária apenas para processar o conteúdo e gerar os flashcards solicitados.
        </p>
        <p>
          O StudyFlash respeita a Lei Geral de Proteção de Dados (LGPD). Seus arquivos não são compartilhados com terceiros para fins de treinamento de modelos públicos sem seu consentimento explícito.
        </p>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">4. Limitação de Responsabilidade</h2>
        <p>
          O StudyFlash não se responsabiliza por resultados em provas, concursos ou exames obtidos com o auxílio da plataforma. O uso da ferramenta é por conta e risco do usuário.
        </p>

        <h2 className="text-xl font-bold text-foreground mt-8 mb-4">5. Alterações nos Termos</h2>
        <p>
          Reservamo-nos o direito de alterar estes termos a qualquer momento. O uso contínuo da plataforma após as alterações constitui aceitação dos novos termos.
        </p>
      </div>
    </div>
  );
}
