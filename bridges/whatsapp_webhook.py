from fastapi import APIRouter, Form
from fastapi.responses import PlainTextResponse

router = APIRouter(prefix="/bridges/whatsapp", tags=["whatsapp"])


@router.post("/webhook")
async def whatsapp_webhook(Body: str = Form(None), From: str = Form(None)):
    return PlainTextResponse("")


@router.get("/webhook")
async def whatsapp_verify():
    return PlainTextResponse("ok")
