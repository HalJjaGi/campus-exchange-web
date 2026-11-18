import { Keyboard } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useMatch } from "react-router-dom";
import { usePolicy } from "@/shared/market/queries";
import { useLivePnl, useWallet } from "@/features/portfolio/queries";
import { NotificationBell } from "@/features/notification/NotificationBell";
import { useOrderFillNotifications } from "@/features/trade/mutations";
import { cx } from "@/shared/lib/cx";
import { toDecimal } from "@/shared/lib/decimal";
import { formatAnnualRate } from "@/shared/lib/format";
import { ConnectionStatus } from "@/shared/ui/ConnectionStatus";
import { IconButton } from "@/shared/ui/IconButton";
import { AsOf, Points } from "@/shared/ui/Numbers";
import { ShortcutModal } from "@/shared/ui/ShortcutModal";
import { Skeleton } from "@/shared/ui/States";
import { toast } from "@/shared/ui/Toast";
import s from "./AppLayout.module.css";
import { UserMenu } from "./UserMenu";

const NAV = [
  { to: "/", label: "대시보드", end: true },
  { to: "/trade", label: "거래" },
  { to: "/community", label: "커뮤니티" },
  { to: "/arcade", label: "오락실" },
  { to: "/me", label: "마이페이지" },
];

const ROUTE_MAP: Record<string, { path: string; name: string; key: string }> = {
  "1": { path: "/", name: "대시보드", key: "1" },
  "2": { path: "/trade", name: "거래", key: "2" },
  "3": { path: "/community", name: "커뮤니티", key: "3" },
  "4": { path: "/arcade", name: "오락실", key: "4" },
  "5": { path: "/me", name: "마이페이지", key: "5" },
  Digit1: { path: "/", name: "대시보드", key: "1" },
  Digit2: { path: "/trade", name: "거래", key: "2" },
  Digit3: { path: "/community", name: "커뮤니티", key: "3" },
  Digit4: { path: "/arcade", name: "오락실", key: "4" },
  Digit5: { path: "/me", name: "마이페이지", key: "5" },
  Numpad1: { path: "/", name: "대시보드", key: "1" },
  Numpad2: { path: "/trade", name: "거래", key: "2" },
  Numpad3: { path: "/community", name: "커뮤니티", key: "3" },
  Numpad4: { path: "/arcade", name: "오락실", key: "4" },
  Numpad5: { path: "/me", name: "마이페이지", key: "5" },
};

export function AppLayout() {
  useOrderFillNotifications();
  // 마이페이지는 같은 정보를 본문에서 자세히 보여 준다
  const onMyPage = useMatch("/me") !== null;
  const navigate = useNavigate();
  const location = useLocation();
  const [shortcutOpen, setShortcutOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      // Meta, Ctrl 조합은 브라우저 기본 단축키 유지
      if (e.metaKey || e.ctrlKey) return;

      const code = e.code;
      const key = e.key.toLowerCase();

      // ? 또는 / 키: 단축키 안내 창 (일반 텍스트 입력 중이 아닐 때)
      const isHelpKey =
        key === "?" ||
        key === "？" ||
        (e.shiftKey && code === "Slash") ||
        (!isInput && (code === "Slash" || key === "/"));

      if (isHelpKey && !isInput) {
        e.preventDefault();
        setShortcutOpen((v) => !v);
        return;
      }

      // Alt (Option) + 1~5는 전역 어디서나 내비게이션
      if (e.altKey) {
        const dest = ROUTE_MAP[code] || ROUTE_MAP[key];
        if (dest) {
          e.preventDefault();
          toast.show(`${dest.name} 화면으로 이동 (Alt+${dest.key})`);
          navigate(dest.path);
          return;
        }
      }

      // 입력창 밖일 때 단독 숫자키 이동
      if (!isInput && !e.altKey && !e.shiftKey) {
        // 거래 화면(/trade)에서는 1~4가 수량 단축키이므로 5(마이페이지)만 이동 허용
        if (location.pathname.startsWith("/trade")) {
          if (code === "Digit5" || code === "Numpad5" || key === "5") {
            e.preventDefault();
            toast.show("마이페이지 화면으로 이동 (단축키 5)");
            navigate("/me");
            return;
          }
        } else {
          // 다른 화면에서는 1~5 모두 이동
          const dest = ROUTE_MAP[code] || ROUTE_MAP[key];
          if (dest) {
            e.preventDefault();
            toast.show(`${dest.name} 화면으로 이동 (단축키 ${dest.key})`);
            navigate(dest.path);
            return;
          }
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, location.pathname]);

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
            <IconButton label="단축키 안내 (?)" onClick={() => setShortcutOpen(true)}>
              <Keyboard size={18} aria-hidden />
            </IconButton>
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
      <ShortcutModal open={shortcutOpen} onClose={() => setShortcutOpen(false)} />
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
