"""One isolated app database and vault for the entire unittest process."""
import atexit
import os
import tempfile
from pathlib import Path

temporary = tempfile.TemporaryDirectory(prefix='lifeos-tests-')
vault = Path(temporary.name) / 'vault'
vault.mkdir()
os.environ['LIFE_OS_DATABASE_PATH'] = str(Path(temporary.name) / 'test.db')
os.environ['LIFE_OS_OBSIDIAN_PATH'] = str(vault)
os.environ['LIFE_OS_AI_PROVIDER'] = 'mock'


def cleanup():
    from app.services.database import engine
    engine.dispose()
    temporary.cleanup()


atexit.register(cleanup)
