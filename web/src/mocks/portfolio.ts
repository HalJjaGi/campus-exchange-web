/**
 * 개발용 가짜 일별 자산 스냅샷. 실제로는 스케줄러가 하루 한 번 기록한다(SD-14).
 * 9·8일 전은 스케줄러가 멈췄던 날로 가정해 기록을 비워 둔다 — 화면이 빈 날을 채우지 않는지 확인용.
 */
import Decimal from "decimal.js-light";
import { kstDate } from "@/features/portfolio/valuation";
import type { AssetHistory, AssetSnapshot, HistoryRange } from "@/shared/types/api";
import { INITIAL_GRANT, JOINED_DAYS_AGO } from "./ledger";
import { totalAsset } from "./market";

const DAY = 86_400_000;
const MISSING_DAYS_AGO = new Set([9, 8]);
const RANGE_DAYS: Record<HistoryRange, number> = { "7d": 7, "30d": 30, "90d": 90 };

interface History {
  /** 가입일(한국 시간). 조회 구간이 이보다 앞서지 않는다 */
  joined: string;
  snapshots: AssetSnapshot[];
}

const histories = new Map<string, History>();
let history: History = { joined: kstDate(Date.now()), snapshots: [] };

/**
 * 계정 자산 기록을 연다. 데모 계정만 지난 기록이 있고, 새 계정은 비어 있다.
 * (가짜 서버에는 하루 한 번 기록하는 스케줄러가 없어서 새 계정 기록은 계속 비어 있다)
 */
export function openHistory(key: string, joinedAt: number, demo: boolean) {
  const existing = histories.get(key);
  if (existing) {
    history = existing;
    return;
  }
  history = { joined: kstDate(joinedAt), snapshots: demo ? seedDemo() : [] };
  histories.set(key, history);
}

function seedDemo(): AssetSnapshot[] {
  const snapshots: AssetSnapshot[] = [];
  const start = new Decimal(INITIAL_GRANT);
  const yesterday = totalAsset().times(0.992 + Math.random() * 0.01);
  for (let ago = JOINED_DAYS_AGO; ago >= 1; ago--) {
    if (MISSING_DAYS_AGO.has(ago)) continue;
    const k = (JOINED_DAYS_AGO - ago) / (JOINED_DAYS_AGO - 1);
    const noise = ago === 1 || ago === JOINED_DAYS_AGO ? 0 : (Math.random() - 0.5) * 0.02;
    const value = start
      .plus(yesterday.minus(start).times(k))
      .times(1 + noise)
      .toDecimalPlaces(0);
    const at = Date.now() - ago * DAY;
    snapshots.push({ date: kstDate(at), totalAsset: value.toString(), evaluatedAt: new Date(at).toISOString() });
  }
  return snapshots;
}

/** 구간 끝은 어제(오늘 스냅샷은 아직 없다). 시작은 가입일보다 앞서지 않는다 */
export function getAssetHistory(range: HistoryRange): AssetHistory {
  const to = kstDate(Date.now() - DAY);
  const wanted = kstDate(Date.now() - RANGE_DAYS[range] * DAY);
  // 오늘 가입했으면 from(오늘) > to(어제)인 빈 구간이 된다. 가입일 전 날짜를 만들지 않는다
  const from = wanted > history.joined ? wanted : history.joined;
  return { from, to, items: history.snapshots.filter((s) => s.date >= from && s.date <= to) };
}
