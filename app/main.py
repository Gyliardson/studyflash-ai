from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from .models import ConjuntoFlashcards, PlanoEstudo, PedidoPlano, PedidoConteudoTopico, PedidoGerarProva, QuestaoProva
from .request_security import get_cors_origins, read_upload_limited, validate_pdf_metadata
from .services import gerar_flashcards_service, extrair_texto_do_pdf, gerar_plano_service, gerar_conteudo_topico_service, gerar_distratores_batch
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="StudyFlash AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.post("/api/gerar", response_model=ConjuntoFlashcards)
async def gerar_flashcards(
    texto: str = Form(None),
    arquivo: UploadFile = File(None),
):
    texto_final = ""

    try:
        if arquivo:
            validate_pdf_metadata(arquivo.filename, arquivo.content_type)
            conteudo_arquivo = await read_upload_limited(arquivo)
            texto_extraido = extrair_texto_do_pdf(conteudo_arquivo)

            if not texto_extraido:
                raise HTTPException(
                    status_code=400,
                    detail="Não foi possível ler o texto deste PDF (pode ser uma imagem digitalizada).",
                )

            texto_final = texto_extraido
        elif texto:
            texto_final = texto
        else:
            raise HTTPException(status_code=400, detail="Envie um texto ou um arquivo PDF.")

        print(f"Gerando flashcards para texto de tamanho: {len(texto_final)} chars")
        return gerar_flashcards_service(texto_final)

    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=422, detail=str(ve)) from ve
    except Exception as exc:
        print(f"Erro interno ao gerar flashcards: {type(exc).__name__}")
        raise HTTPException(status_code=500, detail="Erro interno ao processar solicitação.") from exc


@app.post("/api/gerar-plano", response_model=PlanoEstudo)
async def gerar_plano(pedido: PedidoPlano):
    try:
        return gerar_plano_service(pedido.tema, pedido.dificuldade)
    except Exception as exc:
        print(f"Erro ao gerar plano: {type(exc).__name__}")
        raise HTTPException(status_code=500, detail="Ocorreu um erro ao criar seu plano de estudos.") from exc


@app.post("/api/gerar-cards-topico", response_model=ConjuntoFlashcards)
async def gerar_cards_topico(pedido: PedidoConteudoTopico):
    try:
        return gerar_conteudo_topico_service(pedido.tema_plano, pedido.titulo_topico)
    except Exception as exc:
        print(f"Erro ao gerar conteúdo: {type(exc).__name__}")
        raise HTTPException(status_code=500, detail="Erro ao gerar material didático.") from exc


@app.post("/api/gerar-prova", response_model=list[QuestaoProva])
async def gerar_prova(pedido: PedidoGerarProva):
    try:
        cartoes_processar = pedido.cartoes[:20]
        return await gerar_distratores_batch(cartoes_processar)
    except Exception as exc:
        print(f"Erro ao gerar prova: {type(exc).__name__}")
        raise HTTPException(status_code=500, detail="Erro ao gerar prova com IA.") from exc


@app.get("/")
def health_check():
    return {"status": "ok", "mensagem": "API StudyFlash rodando com suporte a PDF!"}
