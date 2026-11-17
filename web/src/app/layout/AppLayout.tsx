import { NavLink, Outlet, useMatch } from "react-router-dom";
import { usePolicy } from "@/shared/market/queries";
import { useLivePnl, useWallet } from "@/features/portfolio/queries";
import { NotificationBell } from "@/features/notification/NotificationBell";
import { useOrderFillNotifications } from "@/features/trade/mutations";
import { cx } from "@/shared/lib/cx";
import { toDecimal } from "@/shared/lib/decimal";
import { formatAnnualRate } from "@/shared/lib/format";
import { ConnectionStatus } from "@/shared/ui/ConnectionStatus";
import { AsOf, Points } from "@/shared/ui/Numbers";
import { Skeleton } from "@/shared/ui/States";
import s from "./AppLayout.module.css";
import { UserMenu } from "./UserMenu";

const NAV = [
  { to: "/", label: "대시보드", end: true },
  { to: "/trade", label: "거래" },
  { to: "/community", label: "커뮤니티" },
  { to: "/arcade", label: "오락실" },
  { to: "/me", label: "마이페이지" },
];

export function AppLayout() {
  useOrderFillNotifications();
  // 마이페이지는 같은 정보를 본문에서 자세히 보여 준다
  const onMyPage = useMatch("/me") !== null;

  return (
    <div className={s.shell}>
      <header className={s.header}>
        <div className={s.gnb}>
          <NavLink to="/" className={s.logo}>
            캠퍼스 거래소
          </NavLink>
          <nav aria-label="주 메뉴" className={s.nav}>
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) => cx(s.navLink, isActive && s.navActive)}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className={s.right}>
            <ConnectionStatus />
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
        <PolicyBar />
      </header>

      <main className={s.main}>
        <Outlet />
      </main>

      {!onMyPage && <AssetWidget />}
    </div>
  );
}

/** GNB 아래 중앙은행 정책 칩 — 상시 노출 (SCR-02) */
function PolicyBar() {
  const { data, isError } = usePolicy();

  return (
    <div className={s.policyBar}>
      {data ? (
        <>
          <ul className={s.policyItems} aria-label="중앙은행 정책">
            <li>
              기준금리 <strong className="num">{formatAnnualRate(data.baseRate)}</strong>
            </li>
            <li>
              예수금 이자율 <strong className="num">{formatAnnualRate(data.depositRate)}</strong>
            </li>
            <li>
              LP <strong>{data.lpEnabled ? "가동 중" : "중지"}</strong>
            </li>
          </ul>
          <AsOf at={data.updatedAt} live={false} />
        </>
      ) : isError ? (
        <span className={s.policyError}>정책 정보를 불러오지 못했어요</span>
      ) : (
        <Skeleton width={280} height={14} />
      )}
    </div>
  );
}

/** 우측 하단 플로팅 위젯 — 보유 잔액·평가손익·금일 이자 (SCR-02 §6) */
function AssetWidget() {
  const { data, isError, isFetching, refetch } = useWallet();
  const livePnl = useLivePnl();

  return (
    <aside className={s.widget} aria-label="내 자산 요약">
      {data ? (
        <dl className={s.widgetList}>
          <div>
            <dt>사용 가능</dt>
            <dd>
              <Points value={data.available} stale={isError} />
            </dd>
          </div>
          <div>
            <dt>평가손익</dt>
            <dd>
              <Points value={livePnl ?? data.unrealizedPnl} signed stale={isError} />
            </dd>
          </div>
          <div>
            <dt>금일 이자</dt>
            <dd>
              <Points value={data.interestToday} stale={isError} />
            </dd>
          </div>
          {toDecimal(data.reserved).gt(0) && (
            <div>
              <dt>주문 예약</dt>
              <dd>
                <Points value={data.reserved} stale={isError} />
              </dd>
            </div>
          )}
        </dl>
      ) : isError ? (
        <button type="button" className={s.widgetRetry} onClick={() => void refetch()} disabled={isFetching}>
          자산을 불러오지 못했어요 · 다시 시도
        </button>
      ) : (
        <Skeleton width={180} height={60} />
      )}
      {data && isError && <p className={s.widgetStale}>최신 잔고를 확인하지 못했어요</p>}
    </aside>
  );
}
