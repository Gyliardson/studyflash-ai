from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from .models import ConjuntoFlashcards
from .services import gerar_flashcards_service, extrair_texto_do_pdf
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="StudyFlash AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/gerar", response_model=ConjuntoFlashcards)
async def gerar_flashcards(
    texto: str = Form(None),         # Opcional: Texto colado
    arquivo: UploadFile = File(None) # Opcional: Arquivo PDF
):
    texto_final = ""

    try:
        # 1. Prioridade: Se enviou arquivo, processa o PDF
        if arquivo:
            if not arquivo.filename.endswith(".pdf"):
                raise HTTPException(status_code=400, detail="Apenas arquivos PDF são aceitos.")
            
            # Lê os bytes do arquivo
            conteudo_arquivo = await arquivo.read()
            texto_extraido = extrair_texto_do_pdf(conteudo_arquivo)
            
            if not texto_extraido:
                raise HTTPException(status_code=400, detail="Não foi possível ler o texto deste PDF (pode ser uma imagem digitalizada).")
            
            texto_final = texto_extraido

        # 2. Se não tem arquivo, usa o texto colado
        elif texto:
            texto_final = texto

        # 3. Se não tem nenhum dos dois
        else:
            raise HTTPException(status_code=400, detail="Envie um texto ou um arquivo PDF.")

        # Chama o serviço de IA com o texto final
        print(f"Gerando flashcards para texto de tamanho: {len(texto_final)} chars")
        resultado = gerar_flashcards_service(texto_final)
        return resultado

    except ValueError as ve:
        # Aqui capturamos o erro "Conteúdo Insuficiente" do services.py
        # Retornamos 422 (Unprocessable Entity) para o front saber que o input foi ruim
        raise HTTPException(status_code=422, detail=str(ve))
        
    except Exception as e:
        print(f"Erro interno: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao processar solicitação.")

@app.post("/api/debug-pdf")
async def debug_pdf_leitura(arquivo: UploadFile = File(...)):
    if not arquivo.filename.endswith(".pdf"):
        return {"erro": "Por favor, envie um arquivo PDF."}
    
    try:
        # Lê o arquivo
        conteudo = await arquivo.read()
        
        # Usa a mesma função de extração do serviço
        texto_bruto = extrair_texto_do_pdf(conteudo)
        
        # Retorna estatísticas e o texto completo
        return {
            "nome_arquivo": arquivo.filename,
            "tamanho_texto_extraido": len(texto_bruto),
            "preview_do_texto": texto_bruto[:1000], # Primeiros 1000 caracteres
            "conteudo_completo": texto_bruto # Cuidado, pode ser grande
        }
    except Exception as e:
        return {"erro_interno": str(e)}

@app.get("/")
def health_check():
    return {"status": "ok", "mensagem": "API StudyFlash rodando com suporte a PDF!"}