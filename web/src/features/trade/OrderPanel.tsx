import { useQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { usePolicy } from "@/shared/market/queries";
import { formatPercent, formatPoints, formatQuantity } from "@/shared/lib/format";
import type { OrderKind, OrderSide, OrderbookLevel, OrderbookSnapshot, TradingState } from "@/shared/types/api";
import { Chip } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { NumberField } from "@/shared/ui/NumberField";
import { Points } from "@/shared/ui/Numbers";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { ErrorBlock, Skeleton } from "@/shared/ui/States";
import { usePlaceOrder } from "./mutations";
import { useOrderDraft } from "./orderDraft";
import { orderbookQuery, useTradingAccount } from "./queries";
import { checkOrder, parsePrice, quickQuantity, stepPrice, type OrderContext, type OrderIssue } from "./rules";
import s from "./OrderPanel.module.css";

const QUICK = [10, 25, 50, 100] as const;
const NO_LEVELS: OrderbookLevel[] = [];

interface Props {
  code: string;
  tradingState: TradingState;
}

/** 주문 패널(SCR-03 §3~5). 호가창과 독립적으로 렌더링된다 */
export function OrderPanel({ code, tradingState }: Props) {
  const draft = useOrderDraft();
  const policy = usePolicy();
  const account = useTradingAccount(code);

  // 시장가일 때만 반대편 호가를 구독한다. 지정가에서는 호가가 바뀌어도 패널이 다시 그려지지 않는다
  const { data: opposite = NO_LEVELS } = useQuery({
    ...orderbookQuery(code),
    enabled: false,
    select: (snap: OrderbookSnapshot) =>
      draft.kind === "MARKET" ? (draft.side === "BUY" ? snap.asks : snap.bids) : NO_LEVELS,
  });

  const place = usePlaceOrder(() => draft.setQuantity(""));

  const ctx: OrderContext | null = useMemo(
    () =>
      policy.data && account.data
        ? {
            account: account.data,
            feeRate: policy.data.feeRate,
            tickRules: policy.data.tickRules,
            quantityLimits: policy.data.quantityLimits,
            opposite,
          }
        : null,
    [policy.data, account.data, opposite],
  );

  const quantity = draft.quantity ? Number(draft.quantity) : 0;
  const orderDraft = useMemo(
    () => ({ side: draft.side, kind: draft.kind, price: draft.price, quantity }),
    [draft.side, draft.kind, draft.price, quantity],
  );
  const check = ctx ? checkOrder(orderDraft, ctx) : null;
  const halted = tradingState !== "NORMAL";
  const canSubmit =
    !policy.isError && !account.isError && !!check?.preview && check.issues.length === 0 && !halted && !place.isPending;
  const buy = draft.side === "BUY";

  const submit = useCallback(() => {
    if (!canSubmit) return;
    place.submit({
      code,
      side: draft.side,
      kind: draft.kind,
      price: draft.kind === "LIMIT" ? parsePrice(draft.price)?.toString() : undefined,
      quantity,
    });
  }, [canSubmit, place, code, draft.side, draft.kind, draft.price, quantity]);

  // 거래 단축키 (SCR-03) — 한글/영문 자판 및 입력창 포커스 상태 지원
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target &&
        (target.tagName === "TEXTAREA" ||
          (target.tagName === "INPUT" && target.id !== "order-price-input" && target.id !== "order-qty-input") ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      // 일반 텍스트/댓글/검색 입력 중일 때는 타이핑 방해 금지
      if (isTextInput) return;

      const isOrderInput = target && (target.id === "order-price-input" || target.id === "order-qty-input");

      // Ctrl, Meta(Cmd) 조합은 브라우저 기본 단축키 유지 (복사, 새로고침 등)
      if (e.ctrlKey || e.metaKey) return;

      const code = e.code;
      const key = e.key.toLowerCase();

      // B: 매수 (BUY) — 가격/수량 입력창에 포커스가 있어도 동작
      if (code === "KeyB" || key === "b" || key === "ㅠ") {
        e.preventDefault();
        useOrderDraft.getState().setSide("BUY");
        return;
      }

      // S: 매도 (SELL)
      if (code === "KeyS" || key === "s" || key === "ㄴ") {
        e.preventDefault();
        useOrderDraft.getState().setSide("SELL");
        return;
      }

      // L: 지정가 (LIMIT)
      if (code === "KeyL" || key === "l" || key === "ㅣ") {
        e.preventDefault();
        useOrderDraft.getState().setKind("LIMIT");
        return;
      }

      // M: 시장가 (MARKET)
      if (code === "KeyM" || key === "m" || key === "ㅡ") {
        e.preventDefault();
        useOrderDraft.getState().setKind("MARKET");
        return;
      }

      // P: 가격 입력 포커스 (시장가인 경우 지정가로 전환 후 포커스)
      if (code === "KeyP" || key === "p" || key === "ㅔ") {
        e.preventDefault();
        useOrderDraft.getState().setKind("LIMIT");
        requestAnimationFrame(() => {
          const el = document.getElementById("order-price-input") as HTMLInputElement | null;
          el?.focus();
          el?.select();
        });
        return;
      }

      // Q: 수량 입력 포커스
      if (code === "KeyQ" || key === "q" || key === "ㅂ") {
        e.preventDefault();
        const el = document.getElementById("order-qty-input") as HTMLInputElement | null;
        el?.focus();
        el?.select();
        return;
      }

      // 숫자 입력창 내부에서는 일반 숫자 입력을 가로채지 않음 (단, Shift 조합은 허용)
      if (isOrderInput && !e.shiftKey) {
        return;
      }

      // 수량 비율 단축키 (1: 10%, 2: 25%, 3: 50%, 4: 100%)
      let percent: (typeof QUICK)[number] | null = null;
      if (code === "Digit1" || code === "Numpad1" || key === "1" || key === "!") percent = 10;
      else if (code === "Digit2" || code === "Numpad2" || key === "2" || key === "@") percent = 25;
      else if (code === "Digit3" || code === "Numpad3" || key === "3" || key === "#") percent = 50;
      else if (code === "Digit4" || code === "Numpad4" || key === "4" || key === "$") percent = 100;

      if (percent !== null && ctx) {
        e.preventDefault();
        const q = quickQuantity(percent, orderDraft, ctx);
        useOrderDraft.getState().setQuantity(String(q || ""));
        return;
      }

      // Enter: 주문 전송 (입력창 밖일 때)
      if ((code === "Enter" || code === "NumpadEnter") && canSubmit && !isOrderInput) {
        e.preventDefault();
        submit();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ctx, orderDraft, canSubmit, submit]);

  if (policy.isError || account.isError) {
    return (
      <section className={s.panel} aria-label="주문">
        <ErrorBlock
          message="주문 정보를 불러오지 못했어요."
          onRetry={() => {
            void policy.refetch();
            void account.refetch();
          }}
        />
      </section>
    );
  }

  const issueOf = (field: OrderIssue["field"]) => check?.issues.find((i) => i.field === field)?.message;
  // 수량을 아직 입력하지 않았을 때 "수량을 입력해 주세요"로 다그치지 않는다
  const showIssues = quantity > 0 || (draft.kind === "LIMIT" && draft.price !== "");
  const priceError = showIssues ? issueOf("price") : undefined;
  const qtyError = quantity > 0 ? issueOf("quantity") : undefined;
  const fundsError = issueOf("funds");

  return (
    <section className={s.panel} aria-label="주문">
      <form
        className={s.form}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <SegmentedControl<OrderSide>
          label="주문 유형"
          block
          value={draft.side}
          onChange={draft.setSide}
          options={[
            { value: "BUY", label: "매수", tone: "buy" },
            { value: "SELL", label: "매도", tone: "sell" },
          ]}
        />
        <SegmentedControl<OrderKind>
          label="거래 방식"
          size="sm"
          block
          value={draft.kind}
          onChange={draft.setKind}
          options={[
            { value: "LIMIT", label: "지정가" },
            { value: "MARKET", label: "시장가" },
          ]}
        />

        <NumberField
          id="order-price-input"
          label="가격"
          value={draft.price}
          onChange={draft.setPrice}
          onStep={
            policy.data
              ? (dir) => {
                  const base = parsePrice(draft.price);
                  if (!base || !policy.data) return;
                  draft.setPrice(stepPrice(base, dir, policy.data.tickRules).toString());
                }
              : undefined
          }
          disabled={draft.kind === "MARKET"}
          placeholderWhenDisabled="최우선 호가부터 체결"
          error={priceError}
          stepLabels={{ down: "한 호가 내리기", up: "한 호가 올리기" }}
        />

        <div className={s.qtyGroup}>
          <NumberField
            id="order-qty-input"
            label="수량"
            value={draft.quantity}
            onChange={draft.setQuantity}
            onStep={(dir) => draft.setQuantity(String(Math.max(0, quantity + dir)))}
            unit="주"
            error={qtyError}
          />
          <div className={s.quick} role="group" aria-label="수량 비율">
            {QUICK.map((p, idx) => (
              <Chip
                key={p}
                onClick={() => ctx && draft.setQuantity(String(quickQuantity(p, orderDraft, ctx) || ""))}
                title={`단축키: ${idx + 1}`}
              >
                {p === 100 ? "MAX" : `${p}%`}
              </Chip>
            ))}
          </div>
        </div>

        <dl className={s.summary}>
          <div>
            <dt>{buy ? "주문 가능" : "매도 가능"}</dt>
            <dd>
              {!account.data ? (
                <Skeleton width={96} />
              ) : buy ? (
                <Points value={account.data.available} />
              ) : (
                <span className="num">{formatQuantity(account.data.sellableQuantity)}</span>
              )}
            </dd>
          </div>
          <div>
            <dt>{check?.preview?.estimated ? "예상 금액 (추정)" : "예상 금액"}</dt>
            <dd className="num">{check?.preview ? formatPoints(check.preview.gross.toDecimalPlaces(2)) : "—"}</dd>
          </div>
          <div>
            <dt>수수료 {policy.data ? formatPercent(policy.data.feeRate) : ""}</dt>
            <dd className="num">{check?.preview ? formatPoints(check.preview.fee) : "—"}</dd>
          </div>
          <div className={s.total}>
            <dt>{buy ? "필요 금액" : "입금 예정"}</dt>
            <dd className="num">{check?.preview ? formatPoints(check.preview.settlement.toDecimalPlaces(2)) : "—"}</dd>
          </div>
        </dl>

        {check?.preview?.estimated && (
          <p className={s.note}>
            시장가는 지금 호가 기준 추정치예요. 실제 체결가와 다를 수 있어요.
            {check.preview.insufficientBook && " 호가 잔량이 부족해 일부만 체결되고 나머지는 취소될 수 있어요."}
          </p>
        )}

        {(fundsError || halted) && (
          <p className={s.alert} role="alert">
            <TriangleAlert size={16} aria-hidden />
            {halted ? "VI 발동 중이에요. 단일가 매매 주문은 아직 이 화면에서 받을 수 없어요." : fundsError}
          </p>
        )}

        <Button
          type="submit"
          variant={buy ? "buy" : "sell"}
          size="lg"
          block
          busy={place.isPending}
          disabled={!canSubmit && !place.isPending}
          className={s.submit}
        >
          {buy ? "매수 주문" : "매도 주문"}
        </Button>

        <p className={s.shortcutHint}>
          단축키: <kbd>B</kbd> 매수 · <kbd>S</kbd> 매도 · <kbd>L</kbd> 지정가 · <kbd>M</kbd> 시장가 · <kbd>P</kbd> 가격
          · <kbd>Q</kbd> 수량
        </p>
      </form>
    </section>
  );
}
