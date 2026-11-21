"""Additive upgrade for pre-tool-layer SQLite files. Existing rows are preserved."""
from sqlalchemy import inspect


def upgrade_tool_columns(engine):
    additions = {
        'user_profiles': {'workspace_mode': "VARCHAR(20) NOT NULL DEFAULT 'pending'"},
        'tasks': {
            'description': "TEXT NOT NULL DEFAULT ''", 'priority': "VARCHAR(20) NOT NULL DEFAULT 'medium'",
            'review': "TEXT NOT NULL DEFAULT ''", 'focus_date': 'DATE', 'archived': 'BOOLEAN NOT NULL DEFAULT 0',
        },
        'goals': {'outcome': "TEXT NOT NULL DEFAULT ''", 'decisions': "JSON NOT NULL DEFAULT '[]'"},
        'projects': {'description': "TEXT NOT NULL DEFAULT ''"},
    }
    with engine.begin() as connection:
        for table, columns in additions.items():
            if not inspect(connection).has_table(table):
                continue
            existing = {column['name'] for column in inspect(connection).get_columns(table)}
            for column, definition in columns.items():
                if column not in existing:
                    # Identifiers and definitions are fixed above, never from user/model input.
                    connection.exec_driver_sql(f'ALTER TABLE {table} ADD COLUMN {column} {definition}')
