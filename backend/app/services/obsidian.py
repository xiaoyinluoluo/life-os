from pathlib import Path
from app.core.config import settings
from app.integrations.obsidian.obsidian_reader import ObsidianReader

class ObsidianConnector:
    """Compatibility facade. Reads are delegated to the read-only integration."""
    def __init__(self, vault_path: Path):
        self.vault_path = vault_path

    def available(self) -> bool:
        return self.vault_path.is_dir()

    def reader(self) -> ObsidianReader:
        return ObsidianReader(self.vault_path, settings.obsidian_max_file_bytes)

obsidian = ObsidianConnector(settings.obsidian_path)
