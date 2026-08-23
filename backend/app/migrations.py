"""Migracao leve: adiciona coluna nova que apareceu no modelo.

`create_all` cria tabela que nao existe, mas nao mexe em tabela que ja existe. Como
este app vai crescer modulo a modulo, coluna nova em tabela velha e o caso comum —
e sem isso o deploy quebraria com "column does not exist".

O que ela faz: compara o modelo com o banco e roda ALTER TABLE ADD COLUMN pro que
falta. O que ela NAO faz, de proposito: remover coluna, mudar tipo, renomear. Isso
apaga dado, entao continua sendo decisao manual.
"""

from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from .db import Base


def _sql_type(column, dialect) -> str:
    return column.type.compile(dialect=dialect)


def _default_clause(column) -> str:
    """Coluna nova em tabela com dado precisa de valor pras linhas que ja existem."""
    if column.nullable:
        return ""
    default = column.default
    if default is not None and getattr(default, "is_scalar", False):
        value = default.arg
        if isinstance(value, bool):
            return f" DEFAULT {'true' if value else 'false'}"
        if isinstance(value, (int, float)):
            return f" DEFAULT {value}"
        if isinstance(value, str):
            escaped = value.replace("'", "''")
            return f" DEFAULT '{escaped}'"
    return " DEFAULT NULL"


def run(engine: Engine) -> list[str]:
    inspector = inspect(engine)
    applied: list[str] = []
    existing_tables = set(inspector.get_table_names())

    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if table.name not in existing_tables:
                continue  # create_all cuida das novas
            have = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in have:
                    continue
                ddl = (
                    f'ALTER TABLE "{table.name}" '
                    f'ADD COLUMN "{column.name}" {_sql_type(column, engine.dialect)}'
                    f"{_default_clause(column)}"
                )
                conn.execute(text(ddl))
                applied.append(f"{table.name}.{column.name}")
    return applied
