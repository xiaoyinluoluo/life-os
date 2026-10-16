"""Read-only, local Markdown scanner. This module never opens files for writing."""
import csv
import hashlib
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import List


class VaultUnavailable(Exception):
    pass


def canonical_path(path: Path) -> str:
    return os.path.normcase(str(path.resolve()))


def is_link(path: Path) -> bool:
    metadata = path.lstat()
    return path.is_symlink() or bool(getattr(metadata, 'st_file_attributes', 0) & 0x400)


def extract_metadata(content: str):
    tags = set()
    frontmatter = re.match(r'\A---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n|$)', content, re.S)
    body = content
    if frontmatter:
        body = content[frontmatter.end():]
        lines = frontmatter.group(1).splitlines()
        for index, line in enumerate(lines):
            match = re.match(r'^tags\s*:\s*(.*)$', line)
            if not match:
                continue
            value = match.group(1).strip()
            if value:
                values = next(csv.reader([value.strip('[]')], skipinitialspace=True))
            else:
                values = []
                for following in lines[index + 1:]:
                    item = re.match(r'^\s*-\s+(.+)$', following)
                    if not item:
                        break
                    values.append(item.group(1))
            for item in values:
                item = item.strip().strip('\"\'').lstrip('#')
                if item:
                    tags.add(item)
    body = re.sub(r'(?ms)^\s*(```|~~~)[^\n]*\n.*?^\s*\1[^\n]*(?:\n|$)', '', body)
    body = re.sub(r'`[^`]*`', '', body)
    tags.update(re.findall(r'(?<![\w/])#([\w][\w/-]*)', body))
    body = re.sub(r'<!--.*?-->', '', body, flags=re.S)
    body = re.sub(r'!\[.*?\]\(.*?\)', '', body)
    body = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', body)
    body = re.sub(r'^[ \t]*#{1,6}[ \t]+', '', body, flags=re.M)
    summary = re.sub(r'\s+', ' ', body).strip()[:1000]
    return sorted(tags), summary


@dataclass
class Note:
    file_name: str
    file_path: str
    content_hash: str
    summary: str
    tags: List[str]
    created_at: datetime
    updated_at: datetime


@dataclass
class Scan:
    vault_path: str
    notes: List[Note] = field(default_factory=list)
    errors: List[dict] = field(default_factory=list)


class ObsidianReader:
    def __init__(self, vault_path: Path, max_file_bytes: int = 1024 * 1024):
        self.vault_path = vault_path
        self.max_file_bytes = max_file_bytes

    def scan(self) -> Scan:
        if not self.vault_path.is_absolute() or not self.vault_path.is_dir():
            raise VaultUnavailable('Vault 路径必须是存在的绝对目录，请检查后端配置。')
        root = self.vault_path.resolve()
        result = Scan(vault_path=canonical_path(root))

        def on_error(error):
            result.errors.append({'file_path': str(error.filename or root), 'reason': '目录无法读取，本次不会标记删除。'})

        for directory, folders, names in os.walk(str(root), topdown=True, followlinks=False, onerror=on_error):
            allowed = []
            for folder in sorted(folders):
                path = Path(directory) / folder
                try:
                    if not folder.startswith('.') and not is_link(path):
                        path.resolve().relative_to(root)
                        allowed.append(folder)
                except (OSError, ValueError):
                    result.errors.append({'file_path': str(path), 'reason': '目录无法读取，本次不会标记删除。'})
            folders[:] = allowed
            for name in sorted(names):
                path = Path(directory) / name
                if path.suffix.lower() != '.md' or name.startswith('.'):
                    continue
                try:
                    if is_link(path):
                        continue
                    path.resolve().relative_to(root)
                    before = path.stat()
                    if before.st_size > self.max_file_bytes:
                        raise ValueError('文件超过读取大小上限。')
                    with path.open('rb') as handle:
                        raw = handle.read(self.max_file_bytes + 1)
                    after = path.stat()
                    if len(raw) > self.max_file_bytes or before.st_mtime_ns != after.st_mtime_ns or before.st_size != after.st_size:
                        raise ValueError('读取期间文件发生变化，请重新同步。')
                    tags, summary = extract_metadata(raw.decode('utf-8-sig'))
                    result.notes.append(Note(file_name=name, file_path=canonical_path(path), content_hash=hashlib.sha256(raw).hexdigest(), summary=summary, tags=tags,
                        created_at=datetime.fromtimestamp(getattr(after, 'st_birthtime', after.st_ctime), timezone.utc),
                        updated_at=datetime.fromtimestamp(after.st_mtime, timezone.utc)))
                except (OSError, UnicodeError, ValueError) as error:
                    reason = str(error) if isinstance(error, ValueError) and not isinstance(error, UnicodeError) else '文件无法读取或不是 UTF-8 编码。'
                    result.errors.append({'file_path': str(path), 'reason': reason})
        if not root.is_dir():
            raise VaultUnavailable('Vault 在扫描期间不可用，索引未更新。')
        return result
