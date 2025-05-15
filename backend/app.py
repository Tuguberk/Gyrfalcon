"""
Unified Flask API  –  NO scheduler
──────────────────────────────────
Endpoints
---------
GET/POST /generateRiddle     ⟶ picks & returns a fresh riddle
POST      /check_answer      ⟶ verifies a user answer
POST      /reward            ⟶ computes & records a reward

Tables (created automatically)
------------------------------
Riddle, RiddleAnswer, RiddleWinner, RiddleScammer
"""

import os
import random
from datetime import datetime, timedelta, timezone  # UTC yerine timezone getiriyoruz
from typing import Optional

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func

# ── Environment & Flask setup ────────────────────────────────────────────────
load_dotenv()

DB_HOST     = os.getenv("DB_HOST",     "127.0.0.1")
DB_PORT     = os.getenv("DB_PORT",     "5432")
DB_NAME     = os.getenv("DB_NAME",     "postgres")
DB_USER     = os.getenv("DB_USER",     "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = (
    f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# ── Database models ─────────────────────────────────────────────────────────
class Riddle(db.Model):
    id         = db.Column(db.Integer, primary_key=True)
    createDate = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    type       = db.Column(db.String(50))
    question   = db.Column(db.Text)
    isFirst    = db.Column(db.Boolean, default=False)
    isAsked    = db.Column(db.Boolean, default=False)
    answerTime = db.Column(db.DateTime)

    answers    = db.relationship("RiddleAnswer", backref="riddle", lazy=True)


class RiddleAnswer(db.Model):
    id         = db.Column(db.Integer, primary_key=True)
    createDate = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    riddleId   = db.Column(db.Integer, db.ForeignKey("riddle.id"), nullable=False)
    answer     = db.Column(db.Text)


class RiddleWinner(db.Model):
    id           = db.Column(db.Integer, primary_key=True)
    createDate   = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    walletAddress = db.Column(db.String, nullable=False)
    tokenAmount   = db.Column(db.Integer, nullable=False)


class RiddleScammer(db.Model):
    id           = db.Column(db.Integer, primary_key=True)
    createDate   = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    walletAddress = db.Column(db.String, nullable=False)
    tokenAmount   = db.Column(db.Integer, nullable=False)


# ── Helper utilities ────────────────────────────────────────────────────────
def create_tables() -> None:
    with app.app_context():
        db.create_all()


def record_scammer(wallet: str, amount: int = 0) -> None:
    db.session.add(RiddleScammer(walletAddress=wallet, tokenAmount=amount))
    db.session.commit()


def get_second_last_winner():
    winners = (
        RiddleWinner.query.order_by(RiddleWinner.createDate.desc()).limit(2).all()
    )
    return winners[-1] if len(winners) >= 2 else None


def get_wallet_assets(wallet: str) -> dict:
    """Mocked wallet lookup – plug in real service here."""
    mock = {"0xABC": {"tokens": 60, "nfts": 2}, "0xDEF": {"tokens": 30, "nfts": 0}}
    return mock.get(wallet, {"tokens": 0, "nfts": 0})


def calculate_reward(tokens: int, nfts: int) -> int:
    reward = 1
    if tokens > 50 and nfts > 1:
        reward *= 20
    elif nfts > 1:
        reward *= 10
    elif tokens > 50:
        reward *= 5
    return min(reward, 20)


def select_random_riddle() -> Optional[Riddle]:
    """
    Resets isFirst on all riddles, then:
    • picks one random riddle with isAsked = FALSE,
    • if none exist resets the cycle and picks again.
    Returns the Riddle instance or None if table empty.
    """
    # reset all isFirst flags every call
    Riddle.query.update({Riddle.isFirst: False})
    db.session.commit()

    unasked = Riddle.query.filter_by(isAsked=False).all()

    if not unasked:
        # all were used → reset for a new cycle
        Riddle.query.update({Riddle.isAsked: False})
        db.session.commit()
        unasked = Riddle.query.all()
        if not unasked:
            return None

    chosen: Riddle = random.choice(unasked)
    chosen.isAsked = True
    db.session.commit()
    return chosen


# ── API endpoints ───────────────────────────────────────────────────────────
@app.route("/generateRiddle", methods=["GET", "POST"])
def generate_riddle():
    """
    Picks / rotates the next riddle on demand.
    Response:
      200  { riddleId, question }
      404  { error }
    """
    chosen = select_random_riddle()
    if not chosen:
        return jsonify(error="No riddles in database"), 404

    return jsonify(riddleId=chosen.id, question=chosen.question)


@app.route("/check_answer", methods=["POST"])
def check_answer():
    data = request.get_json(silent=True) or {}
    riddle_id   = data.get("riddleId")
    user_answer = data.get("answer")

    if not riddle_id or not user_answer:
        return jsonify(error="Missing parameters: riddleId or answer"), 400

    riddle = Riddle.query.get(riddle_id)
    if not riddle:
        return jsonify(error="Riddle not found"), 404
    if not riddle.isAsked:
        return jsonify(error="This riddle has not been asked yet"), 400

    answer_row = RiddleAnswer.query.filter_by(riddleId=riddle_id).first()
    if not answer_row:
        return jsonify(error="No answer found for this riddle"), 404

    if answer_row.answer.strip().lower() != user_answer.strip().lower():
        return jsonify(message="Sorry, your answer is incorrect."), 200

    # correct answer
    if riddle.isFirst:
        return (
            jsonify(
                message=(
                    "Your answer is correct, but unfortunately you "
                    "are not the first person to answer correctly."
                )
            ),
            200,
        )

    riddle.isFirst   = True
    riddle.answerTime = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(
        message=(
            "Congratulations! Your answer is correct, and you are "
            "the first person to answer correctly."
        )
    )


@app.route("/reward", methods=["POST"])
def reward():
    data   = request.get_json(silent=True) or {}
    wallet = data.get("wallet_address")

    if not wallet:
        return jsonify(status="error", message="Cüzdan adresi zorunludur!"), 400

    today_total = (
        db.session.query(func.coalesce(func.sum(RiddleWinner.tokenAmount), 0))
        .filter(func.date(RiddleWinner.createDate) == datetime.now(timezone.utc).date())
        .scalar()
    )
    if today_total >= 120:
        record_scammer(wallet)
        return (
            jsonify(status="error", message="Günlük ödül limiti (120 token) aşıldı!"),
            400,
        )

    second_last = get_second_last_winner()
    if second_last and (datetime.now(timezone.utc) - second_last.createDate) < timedelta(hours=4):
        record_scammer(wallet)
        return jsonify(status="error", message="Ödül kazanmaya uygun değilsiniz."), 400

    assets       = get_wallet_assets(wallet)
    reward_amt   = calculate_reward(assets["tokens"], assets["nfts"])

    db.session.add(RiddleWinner(walletAddress=wallet, tokenAmount=reward_amt))
    db.session.commit()

    # TODO: real token transfer
    return jsonify(
        status="success",
        wallet=wallet,
        reward_amount=reward_amt,
        message=f"Cüzdana {reward_amt} token gönderilecek.",
    )

@app.get("/health")
def health():
    return {"status": "ok"}, 200

# ── App bootstrap ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    create_tables()
    app.run(debug=True, host="0.0.0.0", port=5005)
