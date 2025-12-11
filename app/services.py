import os
import re
import fitz  # PyMuPDF (A engine poderosa)
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from .models import ConjuntoFlashcards, PlanoEstudo

load_dotenv()

# Inicialização do Chat (Temperatura 0 para precisão técnica)
chat = ChatGroq(temperature=0, model_name="llama-3.3-70b-versatile")

modelo_estruturado = chat.with_structured_output(ConjuntoFlashcards)

# --- PROMPT REFINADO PARA PDFS COMPLEXOS ---
sistema_prompt = """
Você é um ASSISTENTE DE ESTUDO rigoroso.
Sua função é criar flashcards APENAS sobre a **Matéria Técnica** do texto.

### ALGORITMO DE FILTRAGEM (Siga passo a passo):
1. **Identifique o Tópico:** Sobre o que é a aula? (Ex: Inglês, Biologia, História).
2. **Scan de Fatos:** Procure apenas por:
   - Definições e Conceitos.
   - Regras (Gramaticais, Físicas, Matemáticas).
   - Vocabulário e Traduções.
   - Causas e Consequências.
3. **Descarte Agressivo:** Se o texto for "Dica motivacional", "Horário da aula", "Como usar o suporte", "Apresentação do professor" ou "Metodologia do curso", **IGNORE IMEDIATAMENTE**.
   - Exemplo: "Estude 3 vezes por semana" -> LIXO (Não é matéria).
   - Exemplo: "O verbo To Be é Ser/Estar" -> CONTEÚDO (Gere card).

### REGRAS DE SAÍDA:
- Se houver conteúdo técnico suficiente: Gere 5 cards.
- Se houver pouco conteúdo técnico: Gere 1, 2 ou 3 cards.
- Se for APENAS texto motivacional/administrativo: Retorne uma lista vazia.
- **NÃO crie perguntas sobre o curso.** (Ex: "Qual a frequência das aulas?" é PROIBIDO).

Responda APENAS com o JSON.
"""

prompt_template = ChatPromptTemplate.from_messages([
    ("system", sistema_prompt),
    ("human", "{texto_usuario}"),
])

chain = prompt_template | modelo_estruturado

def limpar_texto_pdf(texto_bruto: str) -> str:
    """
    Remove quebras de linha excessivas e caracteres de controle
    que atrapalham a IA.
    """
    # Remove hífens de quebra de linha (ex: "pro- \n grama" -> "programa")
    texto = texto_bruto.replace("-\n", "")
    # Substitui quebras de linha por espaço para criar fluxo contínuo
    texto = texto.replace("\n", " ")
    # Remove espaços múltiplos
    texto = re.sub(r'\s+', ' ', texto)
    return texto.strip()

def extrair_texto_do_pdf(arquivo_bytes: bytes) -> str:
    texto_completo = ""
    doc = None
    try:
        # Abre o PDF direto da memória (Stream)
        doc = fitz.open(stream=arquivo_bytes, filetype="pdf")
        
        for pagina in doc:
            # O modo "text" do PyMuPDF 1.26+ é extremamente capaz de ler
            # caixas de texto, colunas e legendas que o pypdf ignorava.
            texto_pagina = pagina.get_text("text")
            if texto_pagina:
                texto_completo += texto_pagina + " "
        
        return limpar_texto_pdf(texto_completo)
        
    except Exception as e:
        print(f"Erro crítico ao ler PDF com PyMuPDF: {e}")
        return ""
    finally:
        if doc:
            doc.close()

def gerar_flashcards_service(texto: str):
    # 1. Validação de tamanho mínimo (já tínhamos)
    if len(texto) < 50:
        raise ValueError("O texto fornecido é muito curto. Envie um material mais completo.")

    # 2. Limitamos para garantir performance
    texto_processado = texto[:25000]

    # 3. Invoca a IA
    resultado = chain.invoke({"texto_usuario": texto_processado})
    
    # --- PORTÃO DE QUALIDADE ---
    if not resultado.cartoes or len(resultado.cartoes) == 0:
        raise ValueError("A IA não identificou conteúdo educativo suficiente. Tente um texto mais técnico ou acadêmico.")

    return resultado

# === 2. SERVIÇO DE PLANOS DE ESTUDO (V0.3.0) ===

modelo_plano = chat.with_structured_output(PlanoEstudo)

sistema_prompt_plano = """
Você é um TUTOR SÊNIOR e Mentor de Carreira.
Sua missão é criar um CURRÍCULO DE ESTUDOS prático e sequencial.

REGRAS:
1. **Estrutura:** Divida o aprendizado em passos lógicos (do básico ao complexo).
2. **Quantidade:** Crie entre 5 a 10 tópicos (Módulos).
3. **Foco:** Os tópicos devem ser claros e acionáveis (Ex: "Sintaxe Básica" em vez de "Introdução").
4. **Contexto:** Se o usuário pedir algo vago ("Inglês"), assuma um caminho padrão ("Inglês para Viagem" ou "Inglês Geral").

Responda APENAS com o JSON estruturado.
"""

prompt_template_plano = ChatPromptTemplate.from_messages([
    ("system", sistema_prompt_plano),
    ("human", "Quero aprender sobre: {tema}. Meu nível atual é: {dificuldade}."),
])

chain_plano = prompt_template_plano | modelo_plano

def gerar_plano_service(tema: str, dificuldade: str):
    # Pequena validação
    if len(tema) < 2:
        raise ValueError("O tema é muito curto.")

    print(f"🤖 Gerando plano para: {tema} [{dificuldade}]...")
    return chain_plano.invoke({"tema": tema, "dificuldade": dificuldade})

# === 3. SERVIÇO DE CONTEÚDO DE TÓPICO (V0.3.0) ===

sistema_prompt_conteudo = """
Você é um PROFESSOR ESPECIALISTA.
Sua missão é criar flashcards didáticos sobre um Tópico específico de um Curso.

REGRAS:
1. **Contexto:** Os cards devem ser sobre o '{topico}', mas fazendo sentido dentro do curso de '{curso}'.
2. **Quantidade:** Gere exatamente 3 flashcards de alta qualidade.
3. **Estilo:** Perguntas objetivas e respostas explicativas.

Responda APENAS com o JSON (lista de cartoes).
"""

prompt_template_conteudo = ChatPromptTemplate.from_messages([
    ("system", sistema_prompt_conteudo),
    ("human", "Curso: {curso}. Tópico Atual: {topico}. Gere os flashcards."),
])

chain_conteudo = prompt_template_conteudo | modelo_estruturado # Reusa o modelo de flashcards

def gerar_conteudo_topico_service(curso: str, topico: str):
    print(f"🧠 Gerando aula sobre: {topico} ({curso})...")
    return chain_conteudo.invoke({"curso": curso, "topico": topico})