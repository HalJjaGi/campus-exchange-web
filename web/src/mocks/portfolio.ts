/**
 * 개발용 가짜 일별 자산 스냅샷. 실제로는 스케줄러가 하루 한 번 기록한다(SD-14).
 * 9·8일 전은 스케줄러가 멈췄던 날로 가정해 기록을 비워 둔다 — 화면이 빈 날을 채우지 않는지 확인용.
 */
import Decimal from "decimal.js-light";
import { kstDate } from "@/features/portfolio/valuation";
import type { AssetHistory, AssetSnapshot, HistoryRange } from "@/shared/types/api";
import { JOINED_DAYS_AGO } from "./ledger";
import { totalAsset } from "./market";

const DAY = 86_400_000;
const MISSING_DAYS_AGO = new Set([9, 8]);
const RANGE_DAYS: Record<HistoryRange, number> = { "7d": 7, "30d": 30, "90d": 90 };

const snapshots: AssetSnapshot[] = [];

function seed() {
  const start = new Decimal(1_000_000);
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
}
seed();

/** 구간 끝은 어제(오늘 스냅샷은 아직 없다). 시작은 가입일보다 앞서지 않는다 */
export function getAssetHistory(range: HistoryRange): AssetHistory {
  const to = kstDate(Date.now() - DAY);
  const joined = kstDate(Date.now() - JOINED_DAYS_AGO * DAY);
  const wanted = kstDate(Date.now() - RANGE_DAYS[range] * DAY);
  const from = wanted > joined ? wanted : joined;
  return { from, to, items: snapshots.filter((s) => s.date >= from && s.date <= to) };
}
