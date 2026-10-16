import re
from typing import List, Protocol
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.source import Source
from app.integrations.obsidian.obsidian_reader import canonical_path


class KnowledgeRetriever(Protocol):
    """Future vector retrieval can replace the local implementation."""
    def retrieve(self, session: Session, query: str, limit: int = 3) -> List[dict]:
        ...


class KeywordRetriever:
    def retrieve(self, session: Session, query: str, limit: int = 3) -> List[dict]:
        # Do not expose stale content when the authorized vault is unavailable.
        if not settings.obsidian_path.is_dir():
            return []
        tokens = set(re.findall(r'[a-zA-Z0-9]{2,}', query.lower()))
        for phrase in re.findall(r'[\u4e00-\u9fff]+', query):
            tokens.update(phrase[index:index + 2] for index in range(len(phrase) - 1))
        sources = session.scalars(select(Source).where(Source.vault_path == canonical_path(settings.obsidian_path), Source.status == 'active').order_by(Source.updated_at.desc(), Source.id.desc()).limit(2000)).all()
        candidates = []
        for source in sources:
            text = (source.file_name + ' ' + ' '.join(source.tags) + ' ' + source.summary).lower()
            score = sum(1 for token in tokens if token in text)
            if score:
                candidates.append((score, source))
        candidates.sort(key=lambda item: item[0], reverse=True)
        chosen = [item[1] for item in candidates[:limit]]
        mode = 'keyword'
        if not chosen:
            chosen, mode = sources[:limit], 'recent_fallback'
        return [dict(source_id=source.id, file_name=source.file_name, summary=source.summary[:800], tags=source.tags[:20], match=mode) for source in chosen]

retriever: KnowledgeRetriever = KeywordRetriever()
