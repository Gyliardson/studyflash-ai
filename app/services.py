import os
# 1. Importe o dotenv
from dotenv import load_dotenv

# 2. Carregue as variáveis IMEDIATAMENTE
load_dotenv()

from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from .models import ConjuntoFlashcards

# Só agora, depois do load_dotenv(), inicializamos o chat
chat = ChatGroq(temperature=0, model_name="llama-3.3-70b-versatile")

modelo_estruturado = chat.with_structured_output(ConjuntoFlashcards)

sistema_prompt = """
Você é um professor especialista em criar flashcards.
Gere EXATAMENTE 5 pares de pergunta/resposta baseados no texto.
Seja conciso. Responda apenas com o JSON.
"""

prompt_template = ChatPromptTemplate.from_messages([
    ("system", sistema_prompt),
    ("human", "{texto_usuario}"),
])

chain = prompt_template | modelo_estruturado

def gerar_flashcards_service(texto: str):
    resultado = chain.invoke({"texto_usuario": texto})
    return resultado