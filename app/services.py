from __future__ import annotations

import re

import fitz

from .ai_provider import AIProvider, get_ai_provider
from .models import ConjuntoFlashcards, ItemSimuladoInput, PlanoEstudo, QuestaoProva

MAX_TEXT_CHARS = 25_000


def limpar_texto_pdf(texto_bruto: str) -> str:
    texto = texto_bruto.replace("-\n", "").replace("\n", " ")
    return re.sub(r"\s+", " ", texto).strip()


def extrair_texto_do_pdf(arquivo_bytes: bytes) -> str:
    doc = None
    try:
        doc = fitz.open(stream=arquivo_bytes, filetype="pdf")
        parts = [page.get_text("text") for page in doc]
        return limpar_texto_pdf(" ".join(part for part in parts if part))
    except Exception:
        return ""
    finally:
        if doc is not None:
            doc.close()


def _resolve(provider: AIProvider | None) -> AIProvider:
    return provider if provider is not None else get_ai_provider()


def _validate_cards(result: ConjuntoFlashcards, expected: int | None = None) -> ConjuntoFlashcards:
    count = len(result.cartoes)
    if count == 0 or count > 5:
        raise ValueError("Invalid generated flashcard count.")
    if expected is not None and count != expected:
        raise ValueError("Unexpected generated flashcard count.")
    if any(not card.frente.strip() or not card.verso.strip() for card in result.cartoes):
        raise ValueError("Generated flashcard is incomplete.")
    return result


def gerar_flashcards_service(texto: str, provider: AIProvider | None = None) -> ConjuntoFlashcards:
    if len(texto.strip()) < 50:
        raise ValueError("O texto fornecido é muito curto.")
    result = _resolve(provider).generate_flashcards(texto[:MAX_TEXT_CHARS])
    return _validate_cards(result)


def gerar_plano_service(tema: str, dificuldade: str, provider: AIProvider | None = None) -> PlanoEstudo:
    if len(tema.strip()) < 2:
        raise ValueError("O tema é muito curto.")
    result = _resolve(provider).generate_study_plan(tema.strip(), dificuldade)
    if not result.titulo.strip() or not result.descricao.strip() or not 5 <= len(result.topicos) <= 10:
        raise ValueError("Invalid generated study plan.")
    if any(not topic.titulo.strip() for topic in result.topicos):
        raise ValueError("Generated study-plan topic is empty.")
    return result


def gerar_conteudo_topico_service(curso: str, topico: str, provider: AIProvider | None = None) -> ConjuntoFlashcards:
    if not curso.strip() or not topico.strip():
        raise ValueError("Curso e tópico são obrigatórios.")
    return _validate_cards(
        _resolve(provider).generate_topic_cards(curso.strip(), topico.strip()),
        expected=3,
    )


def _validate_options(options: list[str], correct_answer: str) -> list[str]:
    normalized = [option.strip() for option in options if option.strip()]
    if len(normalized) != 4 or len(set(normalized)) != 4:
        raise ValueError("Generated exam alternatives are invalid.")
    if correct_answer.strip() not in normalized:
        raise ValueError("Correct answer is missing from generated alternatives.")
    return normalized


async def gerar_distratores_batch(
    cartoes: list[ItemSimuladoInput],
    provider: AIProvider | None = None,
) -> list[QuestaoProva]:
    resolved = _resolve(provider)
    questions: list[QuestaoProva] = []
    for card in cartoes:
        result = resolved.generate_exam_options(card.frente, card.verso)
        questions.append(
            QuestaoProva(
                card_id=card.id,
                alternativas=_validate_options(result.alternativas, card.verso),
            )
        )
    return questions
