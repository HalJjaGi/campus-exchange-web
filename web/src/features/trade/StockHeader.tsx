import { ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toDecimal } from "@/shared/lib/decimal";
import { directionOf, formatPrice, formatPriceChange, formatQuantity } from "@/shared/lib/format";
import type { StockQuote } from "@/shared/types/api";
import { MoveReasonTag, StockStateBadge } from "@/shared/ui/MarketBadges";
import { AsOf, ChangeRate, PriceText } from "@/shared/ui/Numbers";
import { useStockList } from "@/shared/market/queries";
import s from "./StockHeader.module.css";

const CATEGORY_LABEL: Record<StockQuote["category"], string> = {
  DEPT: "학과주",
  SCHEDULE: "학사일정 테마",
  MEME: "교내 밈 코인",
};

export function StockHeader({ quote }: { quote: StockQuote }) {
  const navigate = useNavigate();
  const list = useStockList();
  const change = toDecimal(quote.price).minus(quote.prevClose);
  const dir = directionOf(change);

  return (
    <header className={s.header}>
      <div className={s.identity}>
        <label className={s.picker}>
          <span className="visually-hidden">종목 선택</span>
          <select className={s.select} value={quote.code} onChange={(e) => navigate(`/trade/${e.target.value}`)}>
            {(list.data ?? [{ code: quote.code, name: quote.name }]).map((st) => (
              <option key={st.code} value={st.code}>
                {st.name}
              </option>
            ))}
          </select>
          <ChevronDown size={18} aria-hidden className={s.chevron} />
        </label>
        <span className={s.meta}>
          {quote.code} · {CATEGORY_LABEL[quote.category]}
        </span>
        <StockStateBadge state={quote.tradingState} exDividendToday={quote.exDividendToday} />
        <MoveReasonTag reason={quote.moveReason} />
      </div>

      <div className={s.price}>
        <PriceText value={quote.price} reference={quote.prevClose} className={s.priceValue} />
        <span className={`num ${s[dir]}`}>{formatPriceChange(change)}</span>
        <ChangeRate ratio={quote.changeRate} className={s.rate} />
      </div>

      <dl className={s.stats}>
        <div>
          <dt>전일 종가</dt>
          <dd className="num">{formatPrice(quote.prevClose)}</dd>
        </div>
        <div>
          <dt>거래량</dt>
          <dd className="num">{formatQuantity(quote.volume, false)}</dd>
        </div>
        <div className={s.asOf}>
          <AsOf at={quote.updatedAt} />
        </div>
      </dl>
    </header>
  );
}
