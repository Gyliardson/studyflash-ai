from __future__ import annotations

import os
import unittest
from unittest.mock import Mock, patch

from app.ai_provider import GroqAIProvider
from app.models import ConjuntoFlashcards, Flashcard


class _PromptStub:
    def __or__(self, structured_model):
        return structured_model


class _ChainStub:
    def __init__(self, result):
        self._result = result

    def invoke(self, _values):
        return self._result


class GroqStructuredOutputContractTests(unittest.TestCase):
    def test_flashcard_prompt_never_requests_an_empty_payload(self) -> None:
        prompt = GroqAIProvider.FLASHCARD_SYSTEM.lower()
        self.assertNotIn("lista vazia", prompt)
        self.assertIn("1 a 5 flashcards", prompt)
        self.assertIn("nunca invente fatos", prompt)

    def test_provider_uses_native_json_schema_strict_for_primary_and_backup(self) -> None:
        provider = GroqAIProvider.__new__(GroqAIProvider)
        provider._primary = Mock()
        provider._backup = Mock()

        result = ConjuntoFlashcards(
            cartoes=[Flashcard(frente="O que é mitose?", verso="Divisão celular.")]
        )
        provider._primary.with_structured_output.return_value = _ChainStub(result)
        provider._backup.with_structured_output.return_value = _ChainStub(result)

        with patch(
            "app.ai_provider.ChatPromptTemplate.from_messages",
            return_value=_PromptStub(),
        ):
            actual = provider.generate_flashcards(
                "Mitose é um processo de divisão celular que gera células-filhas geneticamente equivalentes."
            )

        self.assertEqual(actual, result)
        provider._primary.with_structured_output.assert_called_once_with(
            ConjuntoFlashcards,
            method="json_schema",
            strict=True,
        )
        provider._backup.with_structured_output.assert_called_once_with(
            ConjuntoFlashcards,
            method="json_schema",
            strict=True,
        )

    def test_locked_langchain_groq_builds_strict_json_schema_runnable_without_network(self) -> None:
        with patch.dict(
            os.environ,
            {
                "GROQ_API_KEY": "gsk_test_key_not_used_for_network",
                "GROQ_PRIMARY_MODEL": "openai/gpt-oss-120b",
                "GROQ_BACKUP_MODEL": "openai/gpt-oss-20b",
            },
            clear=False,
        ):
            provider = GroqAIProvider()
            primary = provider._primary.with_structured_output(
                ConjuntoFlashcards,
                method="json_schema",
                strict=True,
            )
            backup = provider._backup.with_structured_output(
                ConjuntoFlashcards,
                method="json_schema",
                strict=True,
            )

        self.assertIsNotNone(primary)
        self.assertIsNotNone(backup)


if __name__ == "__main__":
    unittest.main()
