from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .ai_errors import (
    AIError,
    AIInvalidInputError,
    AIInvalidOutputError,
    AIProviderRateLimitError,
    AIProviderTimeoutError,
    AIProviderUnavailableError,
)
from .models import ConjuntoFlashcards, PedidoConteudoTopico, PedidoGerarProva, PedidoPlano, PlanoEstudo, QuestaoProva
from .request_security import (
    PDFTooLargeError,
    PDFValidationError,
    get_cors_origins,
    read_upload_limited,
    require_internal_api_key,
    validate_pdf_metadata,
)
from .services import extrair_texto_do_pdf, gerar_conteudo_topico_service, gerar_distratores_batch, gerar_flashcards_service, gerar_plano_service

load_dotenv()

app = FastAPI(title="StudyFlash AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


def _ai_http_exception(exc: AIError) -> HTTPException:
    if isinstance(exc, AIInvalidInputError):
        return HTTPException(status_code=422, detail="Os dados enviados não são válidos para esta operação de IA.")
    if isinstance(exc, AIProviderRateLimitError):
        return HTTPException(status_code=429, detail="O serviço de IA está temporariamente no limite de capacidade.")
    if isinstance(exc, AIProviderTimeoutError):
        return HTTPException(status_code=504, detail="O serviço de IA excedeu o tempo limite de resposta.")
    if isinstance(exc, AIProviderUnavailableError):
        return HTTPException(status_code=503, detail="O serviço de IA está temporariamente indisponível.")
    if isinstance(exc, AIInvalidOutputError):
        return HTTPException(status_code=502, detail="O serviço de IA retornou uma resposta inválida.")
    return HTTPException(status_code=503, detail="O serviço de IA não está disponível no momento.")


def _log_ai_failure(operation: str, exc: Exception) -> None:
    # Deliberately log only the domain/type, never provider response bodies or exception text.
    print(f"AI operation failed: operation={operation} type={type(exc).__name__}")


@app.post("/api/gerar", response_model=ConjuntoFlashcards, dependencies=[Depends(require_internal_api_key)])
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

        return gerar_flashcards_service(texto_final)

    except HTTPException:
        raise
    except PDFTooLargeError as exc:
        raise HTTPException(status_code=413, detail="PDF excede o tamanho máximo permitido.") from exc
    except PDFValidationError as exc:
        raise HTTPException(status_code=400, detail="Arquivo PDF inválido.") from exc
    except AIError as exc:
        _log_ai_failure("flashcards", exc)
        raise _ai_http_exception(exc) from exc
    except Exception as exc:
        _log_ai_failure("flashcards-unexpected", exc)
        raise HTTPException(status_code=500, detail="Erro interno ao processar solicitação.") from exc


@app.post("/api/gerar-plano", response_model=PlanoEstudo, dependencies=[Depends(require_internal_api_key)])
async def gerar_plano(pedido: PedidoPlano):
    try:
        return gerar_plano_service(pedido.tema, pedido.dificuldade)
    except AIError as exc:
        _log_ai_failure("study-plan", exc)
        raise _ai_http_exception(exc) from exc
    except Exception as exc:
        _log_ai_failure("study-plan-unexpected", exc)
        raise HTTPException(status_code=500, detail="Erro interno ao processar solicitação.") from exc


@app.post("/api/gerar-cards-topico", response_model=ConjuntoFlashcards, dependencies=[Depends(require_internal_api_key)])
async def gerar_cards_topico(pedido: PedidoConteudoTopico):
    try:
        return gerar_conteudo_topico_service(pedido.tema_plano, pedido.titulo_topico)
    except AIError as exc:
        _log_ai_failure("topic-cards", exc)
        raise _ai_http_exception(exc) from exc
    except Exception as exc:
        _log_ai_failure("topic-cards-unexpected", exc)
        raise HTTPException(status_code=500, detail="Erro interno ao processar solicitação.") from exc


@app.post("/api/gerar-prova", response_model=list[QuestaoProva], dependencies=[Depends(require_internal_api_key)])
async def gerar_prova(pedido: PedidoGerarProva):
    try:
        cartoes_processar = pedido.cartoes[:20]
        return await gerar_distratores_batch(cartoes_processar)
    except AIError as exc:
        _log_ai_failure("exam", exc)
        raise _ai_http_exception(exc) from exc
    except Exception as exc:
        _log_ai_failure("exam-unexpected", exc)
        raise HTTPException(status_code=500, detail="Erro interno ao processar solicitação.") from exc


@app.get("/")
def health_check():
    return {"status": "ok", "mensagem": "API StudyFlash rodando com suporte a PDF!"}
