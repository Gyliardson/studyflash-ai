from __future__ import annotations

import json
import os
from collections.abc import Callable
from functools import lru_cache
from typing import Protocol, TypeVar

from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from pydantic import BaseModel, ValidationError

from .ai_errors import (
    AIInvalidOutputError,
    AIProviderError,
    AIProviderRateLimitError,
    AIProviderTimeoutError,
    AIProviderUnavailableError,
)
from .models import ConjuntoFlashcards, PlanoEstudo, QuestaoProvaGeracao


class AIProvider(Protocol):
    def generate_flashcards(self, text: str) -> ConjuntoFlashcards: ...

    def generate_study_plan(self, topic: str, difficulty: str) -> PlanoEstudo: ...

    def generate_topic_cards(self, course: str, topic: str) -> ConjuntoFlashcards: ...

    def generate_exam_options(self, question: str, correct_answer: str) -> QuestaoProvaGeracao: ...


TModel = TypeVar("TModel", bound=BaseModel)
TResult = TypeVar("TResult")
DEFAULT_PROVIDER_TIMEOUT_SECONDS = 8.0
MAX_PROVIDER_TIMEOUT_SECONDS = 9.0


def _provider_timeout_seconds() -> float:
    raw = os.getenv("AI_PROVIDER_TIMEOUT_SECONDS", str(DEFAULT_PROVIDER_TIMEOUT_SECONDS))
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return DEFAULT_PROVIDER_TIMEOUT_SECONDS
    if value <= 0 or value > MAX_PROVIDER_TIMEOUT_SECONDS:
        return DEFAULT_PROVIDER_TIMEOUT_SECONDS
    return value


def _status_code(exc: Exception) -> int | None:
    value = getattr(exc, "status_code", None)
    return value if isinstance(value, int) else None


def _is_rate_limit_error(exc: Exception) -> bool:
    if _status_code(exc) == 429:
        return True
    message = str(exc).lower()
    return any(token in message for token in ("429", "rate limit", "quota", "too many requests"))


def _is_timeout_error(exc: Exception) -> bool:
    status = _status_code(exc)
    if status in {408, 504}:
        return True
    if isinstance(exc, TimeoutError):
        return True
    name = type(exc).__name__.lower()
    return "timeout" in name or "timedout" in name


def _is_invalid_output_error(exc: Exception) -> bool:
    if isinstance(exc, (ValidationError, json.JSONDecodeError)):
        return True
    name = type(exc).__name__.lower()
    return any(token in name for token in ("outputparser", "parsing", "validation"))


def _is_unavailable_error(exc: Exception) -> bool:
    status = _status_code(exc)
    if status is not None and 500 <= status <= 599:
        return True
    name = type(exc).__name__.lower()
    return any(token in name for token in ("connection", "network", "serviceunavailable"))


def _raise_typed_provider_error(exc: Exception, *, backup: bool = False) -> None:
    if _is_timeout_error(exc):
        raise AIProviderTimeoutError("AI provider timed out") from exc
    if _is_invalid_output_error(exc):
        raise AIInvalidOutputError("AI provider returned invalid structured output") from exc
    if _is_unavailable_error(exc):
        raise AIProviderUnavailableError("AI provider is unavailable") from exc
    prefix = "AI backup provider" if backup else "AI provider"
    raise AIProviderUnavailableError(f"{prefix} request failed") from exc


def invoke_with_bounded_fallback(
    primary: Callable[[], TResult],
    backup: Callable[[], TResult],
) -> TResult:
    """Try the backup once only when the primary failure is rate-limit related."""

    try:
        return primary()
    except Exception as exc:
        if not _is_rate_limit_error(exc):
            _raise_typed_provider_error(exc)

    try:
        return backup()
    except Exception as exc:
        if _is_rate_limit_error(exc):
            raise AIProviderRateLimitError("AI provider rate limit exhausted") from exc
        _raise_typed_provider_error(exc, backup=True)

    raise AIProviderError("AI provider fallback ended unexpectedly")


class GroqAIProvider:
    """Production provider adapter. Remote clients are created only when requested."""

    PRIMARY_MODEL = "openai/gpt-oss-120b"
    BACKUP_MODEL = "openai/gpt-oss-20b"

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
        if not os.getenv("GROQ_API_KEY", "").strip():
            raise AIProviderUnavailableError("AI provider configuration is unavailable")

        timeout = _provider_timeout_seconds()
        primary_model = os.getenv("GROQ_PRIMARY_MODEL", self.PRIMARY_MODEL).strip() or self.PRIMARY_MODEL
        backup_model = os.getenv("GROQ_BACKUP_MODEL", self.BACKUP_MODEL).strip() or self.BACKUP_MODEL
        client_kwargs = {
            "temperature": 0,
            "timeout": timeout,
            "max_retries": 0,
        }
        try:
            self._primary = ChatGroq(model_name=primary_model, **client_kwargs)
            self._backup = ChatGroq(model_name=backup_model, **client_kwargs)
        except (ValidationError, ValueError) as exc:
            # Client-construction validation is an operational configuration failure.
            # Do not catch arbitrary exceptions here: programming defects must remain 500s.
            raise AIProviderUnavailableError("AI provider configuration is invalid") from exc

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
