"""Draft logic — process_draft で指名データを処理し、配属結果・競合・敗者を返す。"""


def process_draft(round_data, winners_map, confirmed_numbers=None):
    """
    Args:
        round_data: { block_name: [指名番号, ...], ... }
        winners_map: { "番号": "勝者ブロック名", ... }  競合解決済みの勝者マップ
        confirmed_numbers: set | None  過去ラウンドで確定済みの番号（文字列set）

    Returns:
        {
            "get_dict":   { block_name: [獲得番号, ...], ... },
            "conflicts":  [ { "val": 番号, "blocks": [...], "winner": str|None }, ... ],
            "losers":     { block_name: 負け回数, ... },
        }
    """
    confirmed = set(str(n) for n in confirmed_numbers) if confirmed_numbers else set()

    block_names = list(round_data.keys())
    get_dict = {name: [] for name in block_names}
    losers = {}

    shimei_dict = {name: round_data.get(name, []) for name in block_names}
    shimei_sets = {name: set(lst) for name, lst in shimei_dict.items()}

    # 確定済み番号を除外（防御的フィルタリング）
    if confirmed:
        for name in block_names:
            shimei_sets[name] = {v for v in shimei_sets[name] if str(v) not in confirmed}

    # ---- 競合なし（単独指名）の番号を先に配属 ----
    for name in block_names:
        others = set().union(*(shimei_sets[n] for n in block_names if n != name))
        unique = shimei_sets[name] - others
        get_dict[name].extend(unique)

    # ---- 全指名番号を走査し、競合を処理 ----
    all_vals = sorted(set().union(*shimei_sets.values())) if shimei_sets else []
    conflict_info = []

    for val in all_vals:
        blocks = [name for name in block_names if val in shimei_sets[name]]

        # 単独指名 → 既に配属済みだが念のため
        if len(blocks) == 1:
            winner = blocks[0]
            if val not in get_dict[winner]:
                get_dict[winner].append(val)
            continue

        # 競合 → winners_map で解決
        winner = winners_map.get(str(val))
        if winner and winner in blocks:
            if val not in get_dict[winner]:
                get_dict[winner].append(val)
            for block in blocks:
                if block != winner:
                    losers[block] = losers.get(block, 0) + 1

        conflict_info.append({
            "val": val,
            "blocks": blocks,
            "winner": winner,
        })

    # 各ブロックの獲得番号をソート
    for name in block_names:
        get_dict[name] = sorted(get_dict[name], key=lambda x: int(x) if str(x).isdigit() else x)

    return {"get_dict": get_dict, "conflicts": conflict_info, "losers": losers}
