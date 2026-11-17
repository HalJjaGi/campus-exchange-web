import { DisclosureList } from "@/features/market/DisclosureList";
import { IndexCard } from "@/features/market/IndexCard";
import { RankingTable } from "@/features/market/RankingTable";
import s from "./DashboardPage.module.css";

/**
 * S-02 메인 대시보드. 정책 칩·자산 위젯은 앱 레이아웃에 있다.
 * [확장] 부재 중 변동 요약·캠퍼스 전광판은 7단계에서 이 자리(지수 위)에 들어간다.
 */
export function DashboardPage() {
  return (
    <div className={s.layout}>
      <div className={s.index}>
        <IndexCard />
      </div>
      <div className={s.ranking}>
        <RankingTable />
      </div>
      <aside className={s.side}>
        <DisclosureList />
      </aside>
    </div>
  );
}
