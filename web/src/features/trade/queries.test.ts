import type { TradeTick } from "@/shared/types/api";
import { mergeTrades } from "./queries";

const t = (id: string, at: string): TradeTick => ({ id, price: "100", quantity: 1, side: "BUY", at });

it("새 체결을 위에 붙이고 같은 ID는 한 번만", () => {
  const cur = [t("b", "2026-11-16T10:00:02Z"), t("a", "2026-11-16T10:00:01Z")];
  const next = mergeTrades(cur, [t("b", "2026-11-16T10:00:02Z"), t("c", "2026-11-16T10:00:03Z")]);
  expect(next.map((x) => x.id)).toEqual(["c", "b", "a"]);
});

it("새 것이 없으면 같은 배열을 돌려준다(불필요한 리렌더 방지)", () => {
  const cur = [t("a", "2026-11-16T10:00:01Z")];
  expect(mergeTrades(cur, [t("a", "2026-11-16T10:00:01Z")])).toBe(cur);
});

it("최대 50건", () => {
  const cur = Array.from({ length: 50 }, (_, i) => t(`o${i}`, `2026-11-16T09:00:${String(i).padStart(2, "0")}Z`));
  expect(mergeTrades(cur, [t("n", "2026-11-16T11:00:00Z")])).toHaveLength(50);
});
