import { create } from "zustand";
import type { OrderKind, OrderSide } from "@/shared/types/api";

/**
 * 주문 입력값. 호가창 클릭이 주문 패널 가격을 바꾸므로 둘이 공유한다.
 * 호가창은 setPrice만 쓰고 값을 읽지 않으므로, 호가가 초당 여러 번 바뀌어도 패널은 리렌더되지 않는다.
 */
interface OrderDraftState {
  code: string | null;
  side: OrderSide;
  kind: OrderKind;
  /** 쉼표 없는 숫자 문자열. 비어 있을 수 있다 */
  price: string;
  /** 비어 있으면 "" */
  quantity: string;
  reset: (code: string, price: string) => void;
  setSide: (side: OrderSide) => void;
  setKind: (kind: OrderKind) => void;
  setPrice: (price: string) => void;
  setQuantity: (quantity: string) => void;
  /** 호가창 행 선택: 지정가로 바꾸고 가격을 넣는다 */
  pickPrice: (price: string) => void;
}

export const useOrderDraft = create<OrderDraftState>((set) => ({
  code: null,
  side: "BUY",
  kind: "LIMIT",
  price: "",
  quantity: "",
  reset: (code, price) => set({ code, price, quantity: "", kind: "LIMIT" }),
  setSide: (side) => set({ side }),
  setKind: (kind) => set({ kind }),
  setPrice: (price) => set({ price }),
  setQuantity: (quantity) => set({ quantity }),
  pickPrice: (price) => set({ price, kind: "LIMIT" }),
}));
