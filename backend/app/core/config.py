import os
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / '.env')

class Settings:
    app_name = 'Life OS'
    version = '0.1.0'
    root = Path(os.getenv('LIFE_OS_ROOT', str(BACKEND_DIR.parent)))
    database_path = Path(os.getenv('LIFE_OS_DATABASE_PATH', str(root / 'data' / 'life_os.db')))
    obsidian_path = Path(os.getenv('LIFE_OS_OBSIDIAN_PATH', str(root / 'obsidian')))
    obsidian_max_file_bytes = int(os.getenv('LIFE_OS_OBSIDIAN_MAX_FILE_BYTES', '1048576'))
    cors_origins = [origin.strip() for origin in os.getenv('LIFE_OS_CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',') if origin.strip()]
    ai_provider = os.getenv('LIFE_OS_AI_PROVIDER', 'mock')
    openai_api_key = os.getenv('OPENAI_API_KEY', '').strip()
    openai_model = os.getenv('LIFE_OS_OPENAI_MODEL', 'gpt-5.4-mini').strip() or 'gpt-5.4-mini'
    deepseek_api_key = os.getenv('DEEPSEEK_API_KEY', '').strip()
    deepseek_model = os.getenv('LIFE_OS_DEEPSEEK_MODEL', 'deepseek-flash').strip() or 'deepseek-flash'
    doubao_api_key = os.getenv('ARK_API_KEY', '').strip()
    doubao_model = os.getenv('LIFE_OS_DOUBAO_MODEL', 'doubao-seed-2-1-pro-260915').strip() or 'doubao-seed-2-1-pro-260915'

settings = Settings()
