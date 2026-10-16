import os
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / '.env')

class Settings:
    app_name = 'Life OS'
    version = '0.1.0'
    root = Path(os.getenv('LIFE_OS_ROOT', str(BACKEND_DIR.parents[2])))
    database_path = Path(os.getenv('LIFE_OS_DATABASE_PATH', str(root / 'data' / 'life_os.db')))
    obsidian_path = Path(os.getenv('LIFE_OS_OBSIDIAN_PATH', str(root / 'obsidian')))
    obsidian_max_file_bytes = int(os.getenv('LIFE_OS_OBSIDIAN_MAX_FILE_BYTES', '1048576'))
    cors_origins = [origin.strip() for origin in os.getenv('LIFE_OS_CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if origin.strip()]
    ai_provider = os.getenv('LIFE_OS_AI_PROVIDER', 'mock')

settings = Settings()
