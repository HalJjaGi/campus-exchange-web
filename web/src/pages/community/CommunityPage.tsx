import { ChevronDown } from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Composer } from "@/features/community/Composer";
import { Feed } from "@/features/community/Feed";
import { useStockList } from "@/shared/market/queries";
import { EmptyState, Skeleton } from "@/shared/ui/States";
import s from "./CommunityPage.module.css";

const DEFAULT_CODE = "CSE";

/** S-04 종목 채널 커뮤니티 */
export function CommunityPage() {
  const { code } = useParams();
  if (!code) return <Navigate to={`/community/${DEFAULT_CODE}`} replace />;
  // 채널을 바꾸면 작성 중이던 글·정렬·구독이 섞이지 않게 통째로 다시 마운트한다
  return <Channel key={code} code={code} />;
}

function Channel({ code }: { code: string }) {
  const navigate = useNavigate();
  const list = useStockList();
  const stock = list.data?.find((st) => st.code === code);

  if (list.data && !stock) {
    return (
      <EmptyState
        message="없는 종목 채널이에요."
        action={<Link to={`/community/${DEFAULT_CODE}`}>기본 채널로 이동</Link>}
      />
    );
  }

  return (
    <div className={s.page}>
      <header className={s.header}>
        {list.data && stock ? (
          <label className={s.picker}>
            <span className="visually-hidden">채널 선택</span>
            <select className={s.select} value={code} onChange={(e) => navigate(`/community/${e.target.value}`)}>
              {list.data.map((st) => (
                <option key={st.code} value={st.code}>
                  {st.name}
                </option>
              ))}
            </select>
            <ChevronDown size={18} aria-hidden className={s.chevron} />
          </label>
        ) : (
          <Skeleton width={160} height={28} />
        )}
        <span className={s.meta}>종목 채널</span>
        <Link to={`/trade/${code}`} className={s.tradeLink}>
          거래하러 가기
        </Link>
      </header>
      {stock && <Composer code={code} stockName={stock.name} />}
      <Feed code={code} />
    </div>
  );
}
