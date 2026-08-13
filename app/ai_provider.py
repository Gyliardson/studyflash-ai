from __future__ import annotations

from collections.abc import Callable
from functools import lru_cache
from typing import Protocol, TypeVar

from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from pydantic import BaseModel

from .models import ConjuntoFlashcards, PlanoEstudo, QuestaoProvaGeracao


class AIProviderError(RuntimeError):
    """Base error raised by the StudyFlash AI provider boundary."""


class AIProviderRateLimitError(AIProviderError):
    """Both configured model attempts were rate limited."""


class AIProvider(Protocol):
    def generate_flashcards(self, text: str) -> ConjuntoFlashcards: ...

    def generate_study_plan(self, topic: str, difficulty: str) -> PlanoEstudo: ...

    def generate_topic_cards(self, course: str, topic: str) -> ConjuntoFlashcards: ...

    def generate_exam_options(self, question: str, correct_answer: str) -> QuestaoProvaGeracao: ...


TModel = TypeVar("TModel", bound=BaseModel)
TResult = TypeVar("TResult")


def _is_rate_limit_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return any(token in message for token in ("429", "rate limit", "quota", "too many requests"))


def invoke_with_bounded_fallback(
    primary: Callable[[], TResult],
    backup: Callable[[], TResult],
) -> TResult:
    """Try the backup once only when the primary failure is rate-limit related."""

    try:
        return primary()
    except Exception as exc:
        if not _is_rate_limit_error(exc):
            raise AIProviderError(f"AI provider request failed: {type(exc).__name__}") from exc

    try:
        return backup()
    except Exception as exc:
        if _is_rate_limit_error(exc):
            raise AIProviderRateLimitError("AI provider rate limit exhausted") from exc
        raise AIProviderError(f"AI backup provider request failed: {type(exc).__name__}") from exc


class GroqAIProvider:
    """Production provider adapter. Remote clients are created only when requested."""

    PRIMARY_MODEL = "llama-3.3-70b-versatile"
    BACKUP_MODEL = "llama-3.1-8b-instant"

    FLASHCARD_SYSTEM = """
Você é um ASSISTENTE DE ESTUDO rigoroso.
Crie flashcards apenas sobre a matéria técnica do texto.
Ignore conteúdo motivacional, administrativo, horários e suporte.
Se não houver conteúdo educativo suficiente, retorne uma lista vazia.
Retorne de 1 a 5 flashcards quando houver conteúdo suficiente.
"""

    PLAN_SYSTEM = """
Você é um tutor sênior. Crie um currículo de estudos prático e sequencial.
Retorne de 5 a 10 tópicos claros e acionáveis e confirme a dificuldade solicitada.
"""

    TOPIC_SYSTEM = """
Você é um professor especialista. Gere exatamente 3 flashcards objetivos e didáticos
sobre o tópico solicitado dentro do contexto do curso informado.
"""

    EXAM_SYSTEM = """
Você é um examinador. Para a pergunta e resposta correta fornecidas, gere exatamente
quatro alternativas únicas: a resposta correta e três distratores plausíveis.
Não use 'todas as anteriores' e não invente IDs.
"""

    def __init__(self) -> None:
        self._primary = ChatGroq(temperature=0, model_name=self.PRIMARY_MODEL)
        self._backup = ChatGroq(temperature=0, model_name=self.BACKUP_MODEL)

    def _invoke_structured(
        self,
        *,
        system_prompt: str,
        human_prompt: str,
        values: dict[str, str],
        schema: type[TModel],
    ) -> TModel:
        prompt = ChatPromptTemplate.from_messages(
            [("system", system_prompt), ("human", human_prompt)]
        )
        primary_chain = prompt | self._primary.with_structured_output(schema)
        backup_chain = prompt | self._backup.with_structured_output(schema)
        return invoke_with_bounded_fallback(
            lambda: primary_chain.invoke(values),
            lambda: backup_chain.invoke(values),
        )

    def generate_flashcards(self, text: str) -> ConjuntoFlashcards:
        return self._invoke_structured(
            system_prompt=self.FLASHCARD_SYSTEM,
            human_prompt="{text}",
            values={"text": text},
            schema=ConjuntoFlashcards,
        )

    def generate_study_plan(self, topic: str, difficulty: str) -> PlanoEstudo:
        return self._invoke_structured(
            system_prompt=self.PLAN_SYSTEM,
            human_prompt="Tema: {topic}. Nível atual: {difficulty}.",
            values={"topic": topic, "difficulty": difficulty},
            schema=PlanoEstudo,
        )

    def generate_topic_cards(self, course: str, topic: str) -> ConjuntoFlashcards:
        return self._invoke_structured(
            system_prompt=self.TOPIC_SYSTEM,
            human_prompt="Curso: {course}. Tópico: {topic}.",
            values={"course": course, "topic": topic},
            schema=ConjuntoFlashcards,
        )

    def generate_exam_options(self, question: str, correct_answer: str) -> QuestaoProvaGeracao:
        return self._invoke_structured(
            system_prompt=self.EXAM_SYSTEM,
            human_prompt="Pergunta: {question}\nResposta correta: {correct_answer}",
            values={"question": question, "correct_answer": correct_answer},
            schema=QuestaoProvaGeracao,
        )


@lru_cache(maxsize=1)
def get_ai_provider() -> AIProvider:
    """Resolve production remote clients lazily, never during module import."""

    return GroqAIProvider()
