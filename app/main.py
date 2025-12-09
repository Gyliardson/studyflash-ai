from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .models import PedidoGeracao, ConjuntoFlashcards
from .services import gerar_flashcards_service
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="StudyFlash AI API")

# --- CORS (Muito Importante) ---
# O CORS permite que o Frontend (que vai rodar em outra porta/domínio) 
# consiga falar com este Backend. Sem isso, o navegador bloqueia tudo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Em produção, mudaremos para o domínio real do Front
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/gerar", response_model=ConjuntoFlashcards)
async def gerar_flashcards(pedido: PedidoGeracao):
    try:
        # Chama a lógica que isolamos no services.py
        resultado = gerar_flashcards_service(pedido.texto)
        return resultado
    except Exception as e:
        # Se der erro, retorna código 500 (Internal Server Error)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def health_check():
    return {"status": "ok", "mensagem": "API StudyFlash rodando!"}