from pydantic import BaseModel, Field
from typing import List

class Flashcard(BaseModel):
    frente: str = Field(description="Pergunta curta ou conceito chave")
    verso: str = Field(description="Resposta direta ou definição concisa")

class ConjuntoFlashcards(BaseModel):
    cartoes: List[Flashcard] = Field(
        description="Lista contendo DE 1 A 5 flashcards. ATENÇÃO: Se o conteúdo for curto, retorne MENOS de 5 itens. Priorize qualidade sobre quantidade."
    )

class PedidoGeracao(BaseModel):
    texto: str