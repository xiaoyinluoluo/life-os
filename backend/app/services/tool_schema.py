"""Additive upgrade for pre-tool-layer SQLite files. Existing rows are preserved."""
from sqlalchemy import inspect


def upgrade_tool_columns(engine):
    additions = {
        'projects': {'description': "TEXT NOT NULL DEFAULT ''"},
        'tasks': {'description': "TEXT NOT NULL DEFAULT ''", 'priority': "VARCHAR(20) NOT NULL DEFAULT 'medium'"},
    }
    with engine.begin() as connection:
        for table, columns in additions.items():
            existing = {column['name'] for column in inspect(connection).get_columns(table)}
            for column, definition in columns.items():
                if column not in existing:
                    # Identifiers and definitions are fixed above, never from user/model input.
                    connection.exec_driver_sql(f'ALTER TABLE {table} ADD COLUMN {column} {definition}')
