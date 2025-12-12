# Histórico de Versões - StudiFlow

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
