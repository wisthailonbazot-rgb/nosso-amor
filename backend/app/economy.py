"""Carteira de Coracoes.

Regra da casa: ninguem mexe em `wallets.balance` direto. Toda mudanca passa por
`earn`/`spend`, que gravam a linha do extrato e recalculam o saldo na mesma
transacao. O saldo e cache; a verdade e a soma de `wallet_transactions`.

`dedupe_key` e o que impede moeda dobrada: check-in do dia, tarefa diaria e
vitoria de partida ja podem cair uma vez so, garantido pelo indice unico do banco
— nao por um `if` que perde a corrida quando o dedo bate duas vezes no botao.
"""

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .models import User, Wallet, WalletTransaction


class AlreadyGranted(Exception):
    """A recompensa com esse dedupe_key ja foi paga."""


def wallet_of(db: Session, user_id: int) -> Wallet:
    wallet = db.get(Wallet, user_id)
    if wallet is None:
        wallet = Wallet(user_id=user_id, balance=0)
        db.add(wallet)
        db.flush()
    return wallet


def balance(db: Session, user_id: int) -> int:
    return wallet_of(db, user_id).balance


def _move(
    db: Session,
    user_id: int,
    amount: int,
    direction: str,
    source: str,
    reference: str = "",
    note: str = "",
    dedupe_key: str | None = None,
) -> WalletTransaction:
    if amount <= 0:
        raise ValueError("amount tem que ser positivo; quem decide o sinal e o direction")

    wallet = db.get(Wallet, user_id)
    if wallet is None:
        wallet = Wallet(user_id=user_id, balance=0)
        db.add(wallet)
        db.flush()

    new_balance = wallet.balance + amount if direction == "earn" else wallet.balance - amount
    if new_balance < 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Coracoes insuficientes: voce tem {wallet.balance} e precisa de {amount}.",
        )

    tx = WalletTransaction(
        user_id=user_id,
        amount=amount,
        direction=direction,
        source=source,
        reference=reference,
        note=note,
        balance_after=new_balance,
        dedupe_key=dedupe_key,
    )
    # Ponto de salvamento em volta da insercao.
    #
    # Sem isso, um `db.rollback()` aqui desfaria a TRANSACAO INTEIRA — inclusive o
    # que a rota ja tinha gravado antes de chamar a carteira (a conclusao da tarefa,
    # por exemplo). O efeito era pior do que perder a moeda: a rota respondia
    # "ganhou 10" e nada tinha sido salvo. Assim, so a linha repetida volta atras.
    try:
        with db.begin_nested():
            db.add(tx)
            db.flush()  # e aqui que o indice unico do dedupe_key barra a repeticao
    except IntegrityError:
        raise AlreadyGranted(dedupe_key or "")

    wallet.balance = new_balance
    db.flush()
    return tx


def earn(
    db: Session,
    user_id: int,
    amount: int,
    source: str,
    reference: str = "",
    note: str = "",
    dedupe_key: str | None = None,
) -> WalletTransaction:
    return _move(db, user_id, amount, "earn", source, reference, note, dedupe_key)


def spend(
    db: Session,
    user_id: int,
    amount: int,
    source: str,
    reference: str = "",
    note: str = "",
    dedupe_key: str | None = None,
) -> WalletTransaction:
    return _move(db, user_id, amount, "spend", source, reference, note, dedupe_key)


def try_earn(db: Session, user_id: int, amount: int, source: str, **kw) -> WalletTransaction | None:
    """Paga se ainda nao foi pago. Devolve None quando o dedupe barrou."""
    try:
        return earn(db, user_id, amount, source, **kw)
    except AlreadyGranted:
        return None


def audit(db: Session, user_id: int) -> dict:
    """Confere o saldo contra o extrato. Usado pelo smoke test e pela tela de perfil."""
    rows = db.query(WalletTransaction).filter(WalletTransaction.user_id == user_id).all()
    computed = sum(r.amount if r.direction == "earn" else -r.amount for r in rows)
    stored = balance(db, user_id)
    return {"stored": stored, "computed": computed, "ok": stored == computed, "entries": len(rows)}


def summary(db: Session, user: User) -> dict:
    return {"user_id": user.id, "balance": balance(db, user.id)}
