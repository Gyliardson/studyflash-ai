# Histórico de Versões - StudiFlow

## [v0.7.0] - 18/12/2025 (Marketing, Legal & Reestruturação de Rotas)

### 🚀 Arquitetura & Rotas (Next.js Route Groups)

- **Separação Lógica:** Implementação de Route Groups para isolar o site institucional da aplicação:
  - `(site)`: Landing Page e páginas públicas.
  - `(platform)`: Dashboard, Coleção e modos de estudo.
- **Rota Protegida:** O antigo `page.tsx` (Dashboard) foi movido para `/dashboard`. A raiz `/` agora é a Landing Page.
- **Refatoração de Imports:** Migração massiva de imports relativos (`../../`) para imports absolutos (`@/app/...`) para evitar quebras em movimentações futuras.

### 🌐 Landing Page & Marketing

- **Nova Home Page:** Página inicial otimizada para conversão com seções de Hero, Features e Prova Social.
- **Botões Inteligentes (Smart Auth):** A interface detecta se o usuário já está logado e altera os botões de "Entrar" para "Ir para o App", evitando erros de sessão do Clerk.
- **Layout Exclusivo:** Criação de um Layout limpo para o site (sem Sidebar/UserHUD) e um Layout focado para a Plataforma.

### ⚖️ Compliance & Legal (LGPD)

- **Páginas Obrigatórias:** Implementação das rotas `/termos` e `/privacidade` com textos adaptados à legislação brasileira.
- **Disclaimer de IA:** Adicionado aviso legal explícito sobre a responsabilidade do usuário na verificação de alucinações da IA.
- **Gestão de Cookies:** Componente `CookieBanner` funcional que persiste o consentimento do usuário via `localStorage`.
- **Canal de Contato:** Link `mailto` integrado ao rodapé para solicitações de suporte e dados.

### 🔧 Fixes & Melhorias

- **Correção Clerk:** Tratamento do erro `cannot_render_single_session_enabled` prevenindo renderização de modais de login quando a sessão já existe.
- **UI Consistency:** Ajuste de alinhamentos na Landing Page para Desktop sem quebrar o Mobile-first.

> Esta versão marca a transição do projeto de "ferramenta" para "produto", introduzindo a camada de vendas e conformidade jurídica necessária para operação pública.

## [v0.6.1] - 18/12/2025 (PWA & Offline Mode)

### 📱 Progressive Web App (PWA)

- **Instalação Nativa:** Agora é possível instalar o StudyFlash como aplicativo no Desktop e Mobile (Adicionado à Home Screen).
- **Suporte Offline:** Implementação de Service Worker (via `@ducanh2912/next-pwa`) para cache inteligente de assets. O app carrega instantaneamente mesmo em redes instáveis.
- **Identidade Mobile:** Configuração completa de `manifest.ts` e ícones adaptativos.

### 🏗️ Infraestrutura & DX

- **Next.js Config:** Ajuste na configuração de build para gerar Service Workers apenas em produção.
- **Compatibilidade:** Adicionada flag `--webpack` no script de dev para garantir compatibilidade de plugins com o Next.js 16.

> Esta versão habilita a distribuição da aplicação como software instalável, aumentando a retenção e performance percebida.

## [v0.6.0] - 15/12/2025 (Design System, Responsividade & Theming)

### 🎨 Interface & UX (Design System)

- **Dark & Light Mode Unificados:** Refatoração completa do sistema de temas usando tokens de tema (Tailwind v4), garantindo alternância consistente entre os modos.
- **Remoção de Cores Hardcoded:** Eliminação de cores fixas (`bg-*`, `text-*`, `dark:*`) em componentes de UI que quebravam o toggle de tema.
- **Harmonia Visual por Tema:** Ajuste fino das paletas para que cada modo (Light/Dark) tenha cores próprias, equilibradas e coerentes.
- **Correção de Cores Neon no Light Mode:** Botões e elementos de destaque (verde, amarelo, vermelho, roxo) agora utilizam tons adequados ao modo claro.
- **Padronização de Superfícies:** Containers de página, cards, banners e modais agora seguem corretamente `bg-background` e `bg-card`.

### 📱 Responsividade & Layout

- **Mobile-First Improvements:** Ajustes de layout e espaçamentos para melhor adaptação em telas pequenas.
- **Header Responsivo:** Correções de alinhamento, comportamento sticky e navegação mobile.
- **Consistência entre Páginas:** Garantia de comportamento visual uniforme em `/colecao`, `/estudar`, `/simulado`, `/planos` e `/perfil`.

### 🧹 Manutenção & Qualidade de Código

- **Auditoria Completa do Frontend:** Revisão geral dos arquivos de UI para remover inconsistências visuais e técnicas.
- **Refatoração Semântica de Componentes:** Melhor uso de tokens como `bg-background`, `bg-card`, `text-foreground`, `border-border`.
- **Base Preparada para Evoluções:** Frontend mais estável e previsível para futuras features (ex: PWA, mobile app, novos modos de estudo).

> Esta versão foca em estabilidade visual, coerência de design e preparação da base para as próximas funcionalidades.

## [v0.5.0] - 14/12/2025 (Modo Simulado & Resiliência de IA)

### ✨ Novas Funcionalidades (Modo Simulado)

- **Engine de Provas:** Novo sistema de Simulado que gera questões de múltipla escolha baseadas nos seus Flashcards.
- **Alternativas via IA:** A IA (Llama-70b) agora cria 3 alternativas falsas ("distratores") plausíveis para cada questão, tornando o teste mais desafiador.
- **Níveis de Dificuldade:**
  - **Prática:** Sem tempo limite.
  - **Exame:** 1m 30s por questão.
  - **Difícil:** 45s por questão.
  - **Impossível:** 20s por questão (Multiplicador de XP 5x).
- **Filtros de Fonte:** Agora é possível criar simulados por **Baralho**, **Tópico**, **Trilha Completa** (Plano) ou **Global** (Tudo).
- **Gamification Balanceado:** XP turbinado para simulados, com **Limite Diário** (apenas os 3 primeiros do dia valem XP) para evitar "farming".

### 🛡️ Backend & Resiliência (AI Safety)

- **Circuit Breaker (Fallback Híbrido):** Implementado sistema robusto que alterna automaticamente entre modelos de IA se o limite for atingido:
  1.  **Principal:** `llama-3.3-70b-versatile` (Alta Inteligência).
  2.  **Backup:** `llama-3.1-8b-instant` (Alta Velocidade/Cota, modo JSON forçado).
  3.  **Local:** Gerador aleatório interno (caso a internet/API falhe totalmente).
- **Rate Limit Throttling:** Adicionada pausa estratégica (`sleep`) entre gerações de questões para evitar erros de "Burst" (429) na API da Groq.
- **Validação de Output:** O sistema agora ignora respostas da IA que não sigam o formato JSON estrito.

### 🎨 Interface & UX (Design System)

- **Redesign da Coleção:** Substituição de emojis por ícones SVG (Heroicons) para um visual mais profissional.
- **Abas de Navegação:** Separação entre "Meus Baralhos" e "Trilhas de Estudo" na tela de coleção.
- **Componentes Customizados:**
  - Novos seletores (Dropdowns) estilizados que substituem o select nativo do navegador.
  - Sliders de quantidade e dificuldade com design moderno.
- **Micro-interações:**
  - Botão de "Lixeira" agora fica invisível e só aparece ao passar o mouse (Hover).
  - Feedback visual de acerto/erro instantâneo após o timer da prova.

### 🐛 Correções & Ajustes

- **Database:** Adicionado campo `sourcePlanId` na tabela `ExamSession` para rastrear simulados de trilhas.
- **Layout:** Correção do alinhamento do Header na página de coleção (`mx-auto`).
- **Input:** Correção da cor da fonte no input de criar baralho (estava branco no fundo branco).
- **Navegação:** Ajuste na leitura de parâmetros de URL (`deckId` vs `decks`) na página de estudo.

## v0.4.0 - Feature: Gamification & Perfil de Usuário (Entregue)

- **Gamification:** Implementado sistema de XP (Criação, Revisão) e Níveis.
- **Gamification:** Implementado sistema de Streak (Ofensiva Diária) com bônus de XP.
- **UI/UX:** Novo componente `UserHUD` no Header, exibindo Nível e Streak.
- **Frontend:** Criada página de `Perfil (/perfil)` com estatísticas e layout revisado.
- **Frontend:** Implementada a lógica **Anti-Abuso** para XP (só ganha se o card estiver vencido).
- **Frontend:** Corrigido bug de concorrência que fazia botões de "Gerar Conteúdo" piscarem ao serem clicados em sequência.

## v0.3.0 - Feature: Tutor IA & Planos de Estudo (Entregue)

- **Feature:** Implementação de "Trilhas de Aprendizado" (`StudyPlan` e `Topic`).
- **IA (Backend):** Novos endpoints para gerar currículos completos e conteúdo por tópico (`/api/gerar-plano`, `/api/gerar-cards-topico`).
- **Frontend:** Nova área de criação `/planos/novo` e visualização de trilha `/planos/[id]`.
- **UI/UX:** Dashboard unificado em `/colecao` (Cards de Planos + Baralhos) e padronização visual dos botões (Outline/Clean).
- **Estudo:** Atualização do algoritmo de revisão para suportar filtros por Plano e Tópico específico.

## v0.2.0 - Feature: Modo Estudo & Sistema SRS (Entregue)

- **Backend:** Implementado algoritmo SM-2 (Repetição Espaçada) no `actions.ts`.
- **Frontend:** Criada página `/estudar` com lógica de revisão diária e modo "Estudar Mais" (Cramming).
- **Frontend:** Implementada seleção múltipla de baralhos na Coleção.
- **UI/UX:** Polimento visual nos Cards e Decks (efeitos 3D, hover, lixeira integrada).
- **Banco de Dados:** Adicionados campos SRS (`nextReview`, `interval`, etc) e `onDelete: Cascade`.

## v0.1.0 - Feature: MVP & Upload de PDF (Entregue)

- **Backend:** Processamento de PDF com PyMuPDF e LangChain.
- **Frontend:** Envio via FormData e geração de flashcards simples.
- **Infra:** Configuração do Prisma v7 com Supabase e Deploy Vercel/Render.
