from pydantic import BaseModel, Field
from typing import List

# === 1. FLASHCARDS (V0.2.0 - Mantido) ===
class Flashcard(BaseModel):
    frente: str = Field(description="Pergunta curta ou conceito chave")
    verso: str = Field(description="Resposta direta ou definição concisa")

class ConjuntoFlashcards(BaseModel):
    cartoes: List[Flashcard] = Field(
        description="Lista contendo DE 1 A 5 flashcards. ATENÇÃO: Se o conteúdo for curto, retorne MENOS de 5 itens. Priorize qualidade sobre quantidade."
    )

class PedidoGeracao(BaseModel):
    texto: str

# === 2. PLANOS DE ESTUDO (V0.3.0 - Novo) ===
class Topico(BaseModel):
    titulo: str = Field(description="Nome do módulo. Ex: 'Fundamentos do State'")
    # A ordem será inferida pela posição na lista

class PlanoEstudo(BaseModel):
    titulo: str = Field(description="Título atrativo do plano. Ex: 'React do Zero ao Hero'")
    descricao: str = Field(description="Resumo motivador do que será aprendido.")
    dificuldade: str = Field(description="Nível confirmado: 'Iniciante', 'Intermediário' ou 'Avançado'")
    topicos: List[Topico] = Field(description="Lista sequencial de 5 a 10 tópicos/módulos para dominar o assunto.")

class PedidoPlano(BaseModel):
    tema: str
    dificuldade: str = "Iniciante"

class PedidoConteudoTopico(BaseModel):
    tema_plano: str
    titulo_topico: str