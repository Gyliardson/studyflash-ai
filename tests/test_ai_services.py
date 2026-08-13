import unittest

from app.ai_provider import AIProviderError
from app.models import (
    ConjuntoFlashcards,
    Flashcard,
    ItemSimuladoInput,
    PlanoEstudo,
    QuestaoProvaGeracao,
    Topico,
)
from app.services import (
    gerar_conteudo_topico_service,
    gerar_distratores_batch,
    gerar_flashcards_service,
    gerar_plano_service,
)


class ScriptedProvider:
    def __init__(self):
        self.flashcards = ConjuntoFlashcards(
            cartoes=[Flashcard(frente="Pergunta", verso="Resposta")]
        )
        self.plan = PlanoEstudo(
            titulo="Plano",
            descricao="Descrição",
            dificuldade="Iniciante",
            topicos=[Topico(titulo=f"Tópico {index}") for index in range(1, 6)],
        )
        self.topic_cards = ConjuntoFlashcards(
            cartoes=[
                Flashcard(frente=f"Pergunta {index}", verso=f"Resposta {index}")
                for index in range(1, 4)
            ]
        )
        self.exam = QuestaoProvaGeracao(
            alternativas=["Correta", "Errada A", "Errada B", "Errada C"]
        )
        self.error = None

    def _maybe_fail(self):
        if self.error is not None:
            raise self.error

    def generate_flashcards(self, text):
        self._maybe_fail()
        return self.flashcards

    def generate_study_plan(self, topic, difficulty):
        self._maybe_fail()
        return self.plan

    def generate_topic_cards(self, course, topic):
        self._maybe_fail()
        return self.topic_cards

    def generate_exam_options(self, question, correct_answer):
        self._maybe_fail()
        return self.exam


class AIServiceTests(unittest.IsolatedAsyncioTestCase):
    def test_flashcards_use_injected_provider_without_remote_credentials(self):
        provider = ScriptedProvider()
        result = gerar_flashcards_service("conteúdo técnico " * 10, provider=provider)
        self.assertEqual(result.cartoes[0].verso, "Resposta")

    def test_flashcard_validation_rejects_empty_generated_set(self):
        provider = ScriptedProvider()
        provider.flashcards = ConjuntoFlashcards(cartoes=[])
        with self.assertRaises(ValueError):
            gerar_flashcards_service("conteúdo técnico " * 10, provider=provider)

    def test_topic_generation_requires_exactly_three_cards(self):
        provider = ScriptedProvider()
        provider.topic_cards = ConjuntoFlashcards(
            cartoes=[Flashcard(frente="Uma", verso="Resposta")]
        )
        with self.assertRaises(ValueError):
            gerar_conteudo_topico_service("Curso", "Tópico", provider=provider)

    def test_study_plan_rejects_invalid_topic_count(self):
        provider = ScriptedProvider()
        provider.plan = PlanoEstudo(
            titulo="Plano",
            descricao="Descrição",
            dificuldade="Iniciante",
            topicos=[Topico(titulo="Único")],
        )
        with self.assertRaises(ValueError):
            gerar_plano_service("Python", "Iniciante", provider=provider)

    async def test_exam_requires_four_unique_options_and_correct_answer(self):
        provider = ScriptedProvider()
        card = ItemSimuladoInput(id="card-1", frente="Pergunta", verso="Correta")
        result = await gerar_distratores_batch([card], provider=provider)
        self.assertEqual(len(result[0].alternativas), 4)
        self.assertIn("Correta", result[0].alternativas)

    async def test_exam_rejects_one_option_fallback_shape(self):
        provider = ScriptedProvider()
        provider.exam = QuestaoProvaGeracao(alternativas=["Correta"])
        card = ItemSimuladoInput(id="card-1", frente="Pergunta", verso="Correta")
        with self.assertRaises(ValueError):
            await gerar_distratores_batch([card], provider=provider)

    async def test_provider_failure_is_not_converted_to_valid_exam_data(self):
        provider = ScriptedProvider()
        provider.error = AIProviderError("provider unavailable")
        card = ItemSimuladoInput(id="card-1", frente="Pergunta", verso="Correta")
        with self.assertRaises(AIProviderError):
            await gerar_distratores_batch([card], provider=provider)


if __name__ == "__main__":
    unittest.main()
