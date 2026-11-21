"""Create and verify a portable SQLite backup without copying API secrets."""
import argparse
import hashlib
import json
import sqlite3
from pathlib import Path
from datetime import datetime, timezone


def create_backup(source, destination):
    source = Path(source).resolve(strict=True)
    destination = Path(destination).resolve()
    if destination.exists():
        raise ValueError('Destination already exists; choose a new backup path')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as original:
        with sqlite3.connect(destination) as backup:
            original.backup(backup)
            if backup.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('Backup integrity check failed')
            counts = {}
            for (name,) in backup.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"):
                quoted = '"' + name.replace('"', '""') + '"'
                counts[name] = backup.execute('SELECT COUNT(*) FROM ' + quoted).fetchone()[0]
    manifest = {'format': 'life-os-sqlite-backup-v1', 'created_at': datetime.now(timezone.utc).isoformat(),
                'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(), 'rows': counts,
                'includes_obsidian_original_files': False, 'includes_api_keys': False}
    destination.with_suffix('.manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    return manifest


def verify_backup(source):
    source = Path(source).resolve(strict=True)
    manifest = json.loads(source.with_suffix('.manifest.json').read_text(encoding='utf-8'))
    if hashlib.sha256(source.read_bytes()).hexdigest() != manifest['sha256']:
        raise ValueError('Backup checksum mismatch')
    with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as db:
        if db.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
            raise ValueError('Backup database is corrupt')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source')
    parser.add_argument('--output')
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    if args.verify:
        result = verify_backup(args.source)
    elif args.output:
        result = create_backup(args.source, args.output)
    else:
        parser.error('Choose --output or --verify')
    print(json.dumps(result, ensure_ascii=False, indent=2))
