import json
import os
from pathlib import Path

try:
    from telegram import Update
    from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, ContextTypes, filters
    HAS_TG = True
except Exception:
    HAS_TG = False

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
MESSAGING_FILE = DATA_DIR / "messaging.json"

def load_cfg():
    if MESSAGING_FILE.exists():
        try:
            return json.loads(MESSAGING_FILE.read_text())
        except Exception:
            pass
    return {"telegram": {"enabled": False}}

class TelegramBridge:
    def __init__(self, server_url="http://127.0.0.1:8080"):
        self.server_url = server_url
        self.app = None
        self.cfg = load_cfg()
    
    async def start_cmd(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        await update.message.reply_text("Agentic OS Bot ready. Send a message to chat with your agent.")
    
    async def handle_msg(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        text = update.message.text or ""
        await update.message.reply_text(f"[Agentic OS] Processing: {text[:60]}...")
    
    def run(self):
        if not HAS_TG:
            print("python-telegram-bot not installed")
            return
        cfg = self.cfg.get("telegram", {})
        token = cfg.get("token") or os.environ.get("TELEGRAM_BOT_TOKEN")
        if not token:
            print("No telegram token")
            return
        self.app = ApplicationBuilder().token(token).build()
        self.app.add_handler(CommandHandler("start", self.start_cmd))
        self.app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_msg))
        print("Telegram bridge starting")
        self.app.run_polling()

if __name__ == "__main__":
    TelegramBridge().run()
