"""Kumano Draft — Bottle API server."""

import json
import os

from bottle import Bottle, request, response, run

from draft_logic import process_draft

app = Bottle()


def _confirmed_lookup():
    """total_get_dict から {str(番号): ブロック名} の逆引き辞書を生成する。"""
    lookup = {}
    for block, nums in state["total_get_dict"].items():
        for n in nums:
            lookup[str(n)] = block
    return lookup


def _confirmed_number_set():
    """total_get_dict に含まれる全確定番号を文字列setで返す。"""
    nums = set()
    for block_nums in state["total_get_dict"].values():
        for n in block_nums:
            nums.add(str(n))
    return nums

# ---- 設定ファイルパス ----
CONFIG_DIR = os.path.join(os.path.dirname(__file__), "..", "config")

# ---- サーバー状態 ----
state = {
    "round": 1,
    "category": 1,
    "status": "input",          # input | done | locked
    "get_dict": {},             # 今ラウンドの獲得結果
    "total_get_dict": {},       # 全ラウンド累積
    "conflicts": [],            # 未解決の競合
    "losers": {},               # 敗者カウント
    "round_data": {},           # 最新の指名データ
    "winners_map": {},          # 競合解決マップ
}


# ---- CORS ----
@app.hook("after_request")
def enable_cors():
    response.headers["Access-Control-Allow-Origin"] = os.environ.get("CORS_ORIGIN", "*")
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"


@app.route("<:re:.*>", method="OPTIONS")
def cors_preflight():
    return {}


# ---- エンドポイント ----

@app.get("/state")
def get_state():
    """現在の状態を返す。"""
    response.content_type = "application/json"
    return json.dumps(state)


@app.post("/submit")
def submit():
    """指名データ送信 → process_draft 呼び出し。"""
    data = request.json or {}
    round_data = data.get("round_data", {})
    winners_map = data.get("winners", {})

    # ---- 確定済み番号の再指名チェック ----
    lookup = _confirmed_lookup()
    violations = []
    for block, nums in round_data.items():
        for n in nums:
            key = str(n)
            if key in lookup:
                violations.append({
                    "number": n,
                    "submitted_by": block,
                    "confirmed_by": lookup[key],
                })
    if violations:
        response.status = 400
        response.content_type = "application/json"
        return json.dumps({
            "error": "確定済み番号が指名されています",
            "violations": violations,
        })

    state["round_data"] = round_data
    state["winners_map"] = winners_map

    confirmed = _confirmed_number_set()
    result = process_draft(round_data, winners_map, confirmed_numbers=confirmed)

    state["get_dict"] = result["get_dict"]
    state["conflicts"] = result["conflicts"]
    state["losers"] = result["losers"]
    state["status"] = "done"

    # 累積マージ
    for block, nums in result["get_dict"].items():
        if block not in state["total_get_dict"]:
            state["total_get_dict"][block] = []
        for n in nums:
            if n not in state["total_get_dict"][block]:
                state["total_get_dict"][block].append(n)

    response.content_type = "application/json"
    return json.dumps(result)


@app.post("/resolve_conflict")
def resolve_conflict():
    """個別競合の勝者を決定する。"""
    data = request.json or {}
    val = str(data.get("val", ""))
    winner = data.get("winner", "")

    if not val or not winner:
        response.status = 400
        return json.dumps({"error": "val and winner are required"})

    state["winners_map"][val] = winner

    # 再計算
    confirmed = _confirmed_number_set()
    result = process_draft(state["round_data"], state["winners_map"], confirmed_numbers=confirmed)
    state["get_dict"] = result["get_dict"]
    state["conflicts"] = result["conflicts"]
    state["losers"] = result["losers"]

    # 累積マージ
    for block, nums in result["get_dict"].items():
        if block not in state["total_get_dict"]:
            state["total_get_dict"][block] = []
        for n in nums:
            if n not in state["total_get_dict"][block]:
                state["total_get_dict"][block].append(n)

    response.content_type = "application/json"
    return json.dumps(result)


@app.post("/next_round")
def next_round():
    """次のラウンドへ進む。"""
    state["round"] += 1
    state["status"] = "input"
    state["get_dict"] = {}
    state["conflicts"] = []
    state["losers"] = {}
    state["round_data"] = {}
    state["winners_map"] = {}

    response.content_type = "application/json"
    return json.dumps({"round": state["round"], "status": state["status"]})


@app.post("/next_category")
def next_category():
    """次のカテゴリへ進む。"""
    state["category"] += 1
    state["round"] = 1
    state["status"] = "input"
    state["get_dict"] = {}
    state["total_get_dict"] = {}
    state["conflicts"] = []
    state["losers"] = {}
    state["round_data"] = {}
    state["winners_map"] = {}

    response.content_type = "application/json"
    return json.dumps({"category": state["category"], "round": state["round"], "status": state["status"]})


@app.post("/reset")
def reset():
    """状態を完全リセットする。"""
    state["round"] = 1
    state["category"] = 1
    state["status"] = "input"
    state["get_dict"] = {}
    state["total_get_dict"] = {}
    state["conflicts"] = []
    state["losers"] = {}
    state["round_data"] = {}
    state["winners_map"] = {}

    response.content_type = "application/json"
    return json.dumps({"message": "reset"})


@app.get("/config")
def get_config():
    """設定JSON3つを返す。"""
    configs = {}
    for name in ("draft_settings", "block_slots", "rookies"):
        filepath = os.path.join(CONFIG_DIR, f"{name}.json")
        try:
            with open(filepath, encoding="utf-8") as f:
                configs[name] = json.load(f)
        except FileNotFoundError:
            configs[name] = None

    response.content_type = "application/json"
    return json.dumps(configs)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    run(app, host="0.0.0.0", port=port)
