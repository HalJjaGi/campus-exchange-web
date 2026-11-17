import { Check, TriangleAlert } from "lucide-react";
import type { DecimalString } from "@/shared/lib/decimal";
import { formatPercent } from "@/shared/lib/format";
import type { MoveReason, TradingState } from "@/shared/types/api";
import { Badge } from "./Badge";

/** DESIGN.md §5.2. 일반 매매는 기본 상태라 표시하지 않는다 */
export function StockStateBadge({ state, exDividendToday }: { state: TradingState; exDividendToday?: boolean }) {
  return (
    <>
      {state === "VI_ACTIVE" && <Badge tone="attention">VI 발동 중</Badge>}
      {state === "SINGLE_PRICE" && <Badge tone="outline">단일가 매매</Badge>}
      {exDividendToday && <Badge tone="positive">배당락 D-Day</Badge>}
    </>
  );
}

const REASON_LABEL: Record<MoveReason, string> = {
  DISCLOSURE: "공시",
  EVENT: "이벤트",
  PARTICIPANT_SURGE: "참여자 급증",
};

/** 서버가 근거와 함께 붙인 사유만 받는다. null이면 그리지 않는다 */
export function MoveReasonTag({ reason }: { reason: MoveReason | null }) {
  if (!reason) return null;
  return <Badge tone="outline">{REASON_LABEL[reason]}</Badge>;
}

export function VerifiedBadge({ kind }: { kind: "REAL_HOLD" | "SHORT" }) {
  return (
    <Badge tone="positive" icon={<Check aria-hidden />}>
      {kind === "REAL_HOLD" ? "실보유 인증" : "공매도 인증"}
    </Badge>
  );
}

export function LpMark() {
  return (
    <Badge tone="lp">
      LP<span className="visually-hidden"> 유동성 공급 물량</span>
    </Badge>
  );
}

/** 담보 유지비율 경고. 색만이 아니라 아이콘과 수치를 함께 보여준다 */
export function MarginWarningBadge({ ratio }: { ratio: DecimalString }) {
  return (
    <Badge tone="danger" icon={<TriangleAlert aria-hidden />}>
      유지비율 {formatPercent(ratio, 0)}
    </Badge>
  );
}
