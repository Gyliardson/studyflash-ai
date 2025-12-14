import os
import re
import time  # [NOVO] Para controlar o ritmo das requisições
import fitz  # PyMuPDF
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
# Importando os modelos corretos
from .models import ConjuntoFlashcards, PlanoEstudo, QuestaoProva, QuestaoProvaGeracao, ItemSimuladoInput

load_dotenv()

# === CONFIGURAÇÃO DE DEBUG E MODELOS ===
# Mude para False se quiser ver o erro explodir na tela (bom para debug)
USAR_BACKUP = True 

MODELO_PRINCIPAL = "llama-3.3-70b-versatile"
MODELO_BACKUP = "llama-3.1-8b-instant"

chat_main = ChatGroq(temperature=0, model_name=MODELO_PRINCIPAL)
chat_backup = ChatGroq(temperature=0, model_name=MODELO_BACKUP)

# Configura saídas estruturadas
modelo_flashcards_main = chat_main.with_structured_output(ConjuntoFlashcards)
modelo_flashcards_backup = chat_backup.with_structured_output(ConjuntoFlashcards)

modelo_plano_main = chat_main.with_structured_output(PlanoEstudo)
modelo_plano_backup = chat_backup.with_structured_output(PlanoEstudo)

# === FUNÇÃO HELPER DE RESILIÊNCIA (CIRCUIT BREAKER) ===
def invocar_com_fallback(chain_main, chain_backup, input_data, contexto="IA"):
    try:
        return chain_main.invoke(input_data)
    except Exception as e:
        erro_msg = str(e).lower()
        
        # Filtra erros de limite (Rate Limit / Quota)
        eh_rate_limit = "429" in erro_msg or "rate limit" in erro_msg or "quota" in erro_msg or "too many requests" in erro_msg
        
        # Só usa backup se o erro for de limite E a flag estiver ativa
        if eh_rate_limit and USAR_BACKUP:
            print(f"⚠️ [ALERTA] Limite do {MODELO_PRINCIPAL} atingido no serviço '{contexto}'.")
            print(f"📉 Motivo: {erro_msg[:200]}...") # Imprime o começo do erro para sabermos o porquê
            print(f"🔄 Alternando para rota de emergência: {MODELO_BACKUP}...")
            return chain_backup.invoke(input_data)
        
        # Se USAR_BACKUP for False ou o erro for outro (bug), estoura o erro real
        print(f"❌ Erro na IA ({contexto}) - Backup não ativado ou erro crítico: {e}")
        raise e

# === 1. SERVIÇO DE FLASHCARDS (PDF/TEXTO) ===

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

# Cria as duas chains (Principal e Backup)
chain_flash_main = prompt_template | modelo_flashcards_main
chain_flash_backup = prompt_template | modelo_flashcards_backup

def limpar_texto_pdf(texto_bruto: str) -> str:
    texto = texto_bruto.replace("-\n", "")
    texto = texto.replace("\n", " ")
    texto = re.sub(r'\s+', ' ', texto)
    return texto.strip()

def extrair_texto_do_pdf(arquivo_bytes: bytes) -> str:
    texto_completo = ""
    doc = None
    try:
        doc = fitz.open(stream=arquivo_bytes, filetype="pdf")
        for pagina in doc:
            texto_pagina = pagina.get_text("text")
            if texto_pagina:
                texto_completo += texto_pagina + " "
        return limpar_texto_pdf(texto_completo)
    except Exception as e:
        print(f"Erro crítico ao ler PDF: {e}")
        return ""
    finally:
        if doc: doc.close()

def gerar_flashcards_service(texto: str):
    if len(texto) < 50:
        raise ValueError("O texto fornecido é muito curto.")

    texto_processado = texto[:25000]

    # USA O SISTEMA DE FALLBACK
    resultado = invocar_com_fallback(
        chain_flash_main, 
        chain_flash_backup, 
        {"texto_usuario": texto_processado},
        "Gerar Flashcards"
    )
    
    if not resultado.cartoes or len(resultado.cartoes) == 0:
        raise ValueError("A IA não identificou conteúdo educativo suficiente.")

    return resultado

# === 2. SERVIÇO DE PLANOS DE ESTUDO ===

sistema_prompt_plano = """
Você é um TUTOR SÊNIOR e Mentor de Carreira.
Sua missão é criar um CURRÍCULO DE ESTUDOS prático e sequencial.

### PROTOCOLO DE SEGURANÇA
Analise o tema. Se envolver ilegalidade, violência, NSFW ou hacking malicioso:
- titulo: "TEMA BLOQUEADO"
- descricao: "Conteúdo viola diretrizes de segurança."
- dificuldade: "Iniciante"
- topicos: 1 tópico "Violação de Diretrizes".

### REGRAS PARA TEMAS VÁLIDOS:
1. **Estrutura:** Divida em passos lógicos.
2. **Quantidade:** 5 a 10 tópicos.
3. **Foco:** Tópicos claros e acionáveis.

Responda APENAS com o JSON estruturado.
"""

prompt_template_plano = ChatPromptTemplate.from_messages([
    ("system", sistema_prompt_plano),
    ("human", "Quero aprender sobre: {tema}. Meu nível atual é: {dificuldade}."),
])

chain_plano_main = prompt_template_plano | modelo_plano_main
chain_plano_backup = prompt_template_plano | modelo_plano_backup

def gerar_plano_service(tema: str, dificuldade: str):
    if len(tema) < 2:
        raise ValueError("O tema é muito curto.")

    print(f"🤖 Gerando plano para: {tema} [{dificuldade}]...")
    
    return invocar_com_fallback(
        chain_plano_main,
        chain_plano_backup,
        {"tema": tema, "dificuldade": dificuldade},
        "Gerar Plano"
    )

# === 3. SERVIÇO DE CONTEÚDO DE TÓPICO ===

sistema_prompt_conteudo = """
Você é um PROFESSOR ESPECIALISTA.
Sua missão é criar flashcards didáticos sobre um Tópico específico de um Curso.

REGRAS:
1. **Contexto:** Os cards devem ser sobre o '{topico}', mas fazendo sentido dentro do curso de '{curso}'.
2. **Quantidade:** Gere exatamente 3 flashcards.
3. **Estilo:** Perguntas objetivas e respostas explicativas.

Responda APENAS com o JSON (lista de cartoes).
"""

prompt_template_conteudo = ChatPromptTemplate.from_messages([
    ("system", sistema_prompt_conteudo),
    ("human", "Curso: {curso}. Tópico Atual: {topico}. Gere os flashcards."),
])

# Reusa os modelos de flashcard estruturado
chain_conteudo_main = prompt_template_conteudo | modelo_flashcards_main
chain_conteudo_backup = prompt_template_conteudo | modelo_flashcards_backup

def gerar_conteudo_topico_service(curso: str, topico: str):
    print(f"🧠 Gerando aula sobre: {topico} ({curso})...")
    
    return invocar_com_fallback(
        chain_conteudo_main,
        chain_conteudo_backup,
        {"curso": curso, "topico": topico},
        "Gerar Conteúdo Tópico"
    )

# === 4. SERVIÇO DE PROVA/SIMULADO (V0.5.1 - CORRIGIDO) ===

# [ATUALIZADO] Usamos o modelo SEM ID para a IA não se confundir
modelo_prova_main = chat_main.with_structured_output(QuestaoProvaGeracao)
modelo_prova_backup = chat_backup.with_structured_output(QuestaoProvaGeracao)

sistema_prompt_prova = """
Você é um EXAMINADOR DE BANCA.
Sua tarefa é criar alternativas para uma questão de Múltipla Escolha.

Entrada:
- Pergunta (Frente)
- Resposta Correta (Verso)

Sua Missão:
1. Analise a Resposta Correta.
2. Crie 3 (TRÊS) "Distratores" (Alternativas Erradas) PLAUSÍVEIS.
3. NÃO use "Todas as anteriores".

Saída:
- Retorne APENAS a lista 'alternativas' com a Resposta Correta + 3 Erradas.
- NÃO invente IDs.
"""

prompt_template_prova = ChatPromptTemplate.from_messages([
    ("system", sistema_prompt_prova),
    ("human", "Pergunta: {frente}\nResposta Correta: {verso}"),
])

chain_prova_main = prompt_template_prova | modelo_prova_main
chain_prova_backup = prompt_template_prova | modelo_prova_backup

async def gerar_distratores_batch(cartoes: list[ItemSimuladoInput]):
    questoes_geradas = []
    print(f"🕵️ Gerando prova com {len(cartoes)} questões...")

    for card in cartoes:
        try:
            # Invoca a IA pedindo apenas as alternativas
            resultado_ia = invocar_com_fallback(
                chain_prova_main,
                chain_prova_backup,
                {"frente": card.frente, "verso": card.verso},
                "Gerar Questão Simulado"
            )
            
            # [CORREÇÃO] A gente (Python) preenche o ID, não a IA.
            questao_completa = QuestaoProva(
                card_id=card.id,
                alternativas=resultado_ia.alternativas
            )
            
            questoes_geradas.append(questao_completa)
            
        except Exception as e:
            # O print já acontece no invocar_com_fallback se não for rate limit
            # Fallback final silencioso: retorna só a correta
            questoes_geradas.append(QuestaoProva(card_id=card.id, alternativas=[card.verso]))

    return questoes_geradas

# === REINCLUIR AS FUNÇÕES ANTERIORES QUE NÃO MUDARAM ===
# (Para facilitar o copy-paste, aqui estão elas resumidas, caso você tenha apagado)

def limpar_texto_pdf(texto_bruto: str) -> str:
    texto = texto_bruto.replace("-\n", "")
    texto = texto.replace("\n", " ")
    texto = re.sub(r'\s+', ' ', texto)
    return texto.strip()

def extrair_texto_do_pdf(arquivo_bytes: bytes) -> str:
    texto_completo = ""
    doc = None
    try:
        doc = fitz.open(stream=arquivo_bytes, filetype="pdf")
        for pagina in doc:
            texto_pagina = pagina.get_text("text")
            if texto_pagina:
                texto_completo += texto_pagina + " "
        return limpar_texto_pdf(texto_completo)
    except Exception as e:
        print(f"Erro crítico ao ler PDF: {e}")
        return ""
    finally:
        if doc: doc.close()