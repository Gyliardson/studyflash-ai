
from pydantic import BaseModel, Field
from typing import List

class Flashcard(BaseModel):
    frente: str = Field(description="Pergunta curta ou conceito chave")
    verso: str = Field(description="Resposta direta ou definição concisa")

class ConjuntoFlashcards(BaseModel):
    cartoes: List[Flashcard] = Field(description="Lista de flashcards gerados")

class PedidoGeracao(BaseModel):
    texto: str