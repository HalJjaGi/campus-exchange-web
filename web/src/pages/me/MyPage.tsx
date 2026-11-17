import { useSearchParams } from "react-router-dom";
import { ProfileCard } from "@/features/auth/ProfileCard";
import { AssetDonut } from "@/features/portfolio/AssetDonut";
import { AssetHistoryChart } from "@/features/portfolio/AssetHistoryChart";
import { AssetSummary } from "@/features/portfolio/AssetSummary";
import { HoldingsTable } from "@/features/portfolio/HoldingsTable";
import { LedgerList } from "@/features/portfolio/LedgerList";
import { Tabs } from "@/shared/ui/Tabs";
import s from "./MyPage.module.css";

type Tab = "holdings" | "ledger";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "holdings", label: "보유 종목" },
  { value: "ledger", label: "거래 내역" },
];

/**
 * S-06 마이페이지. 영역마다 따로 조회해 한 곳이 실패해도 나머지는 그대로 보인다(UC-14 예외 흐름).
 * [확장] 공매도·이자·배당·전광판 입찰 탭은 7단계에서 TABS에 붙는다.
 */
export function MyPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "ledger" ? "ledger" : "holdings";

  return (
    <div className={s.page}>
      <ProfileCard />

      <div className={s.overview}>
        <AssetSummary />
        <AssetDonut />
      </div>

      <AssetHistoryChart />

      <section className={s.tabs}>
        <Tabs<Tab>
          label="자산 상세"
          idPrefix="me"
          items={TABS}
          value={tab}
          onChange={(t) => setParams(t === "holdings" ? {} : { tab: t }, { replace: true })}
        />
        <div role="tabpanel" id={`me-panel-${tab}`} aria-labelledby={`me-tab-${tab}`}>
          {tab === "holdings" ? <HoldingsTable /> : <LedgerList />}
        </div>
      </section>
    </div>
  );
}
