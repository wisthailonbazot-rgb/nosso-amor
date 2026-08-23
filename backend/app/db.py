from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import DATABASE_URL

IS_SQLITE = DATABASE_URL.startswith("sqlite")
# `timeout` cobre a janela curta em que HTTP e WebSocket atualizam o mesmo banco
# local. Sem ele, a segunda gravacao falhava imediatamente com "database is
# locked"; a tela do pet foi a primeira a tornar essa corrida visivel.
connect_args = {"check_same_thread": False, "timeout": 30} if IS_SQLITE else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)

if IS_SQLITE:
    # O driver de SQLite do Python abre transacao por conta propria, na hora errada,
    # e com isso SAVEPOINT e rollback nao se comportam como num banco de verdade:
    # um `rollback()` deixava linhas pra tras e um ponto de salvamento nao isolava
    # nada. Em producao e PostgreSQL e o problema nao existe — mas o teste roda em
    # SQLite, e um teste que mente sobre rollback e pior do que nao ter teste.
    #
    # A correcao e a documentada pelo SQLAlchemy: desligar o controle automatico do
    # driver e emitir o BEGIN na mao.
    @event.listens_for(engine, "connect")
    def _sqlite_no_implicit_begin(dbapi_connection, _record):
        dbapi_connection.isolation_level = None
        dbapi_connection.execute("PRAGMA foreign_keys=ON")
        dbapi_connection.execute("PRAGMA busy_timeout=30000")
        # WAL deixa leitores seguirem enquanto outra conexao grava. E so para a
        # bancada SQLite; producao continua PostgreSQL, sem esta configuracao.
        dbapi_connection.execute("PRAGMA journal_mode=WAL")

    @event.listens_for(engine, "begin")
    def _sqlite_explicit_begin(connection):
        connection.exec_driver_sql("BEGIN")


SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
