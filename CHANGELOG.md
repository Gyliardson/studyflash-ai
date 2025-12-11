# Histórico de Versões - StudiFlow

## v0.2.0 - Feature: Modo Estudo & Sistema SRS (Entregue)
- **Backend:** Implementado algoritmo SM-2 (Repetição Espaçada) no `actions.ts`.
- **Frontend:** Criada página `/estudar` com lógica de revisão diária e modo "Estudar Mais" (Cramming).
- **Frontend:** Implementada seleção múltipla de baralhos na Coleção.
- **UI/UX:** Polimento visual nos Cards e Decks (efeitos 3D, hover, lixeira integrada).
- **Banco de Dados:** Adicionados campos SRS (`nextReview`, `interval`, etc) e `onDelete: Cascade`.

## v0.1.0 - Feature: MVP & Upload de PDF
- **Backend:** Processamento de PDF com PyMuPDF e LangChain.
- **Frontend:** Envio via FormData e geração de flashcards simples.
- **Infra:** Configuração do Prisma v7 com Supabase e Deploy Vercel/Render.