import type { DisclosureType } from "@/shared/types/api";

/** 공시 종류 이름. 대시보드 공시 목록·차트 마커·커뮤니티 공시 카드가 함께 쓴다 */
export const DISCLOSURE_TYPE_LABEL: Record<DisclosureType, string> = {
  DIVIDEND: "배당",
  BURN: "소각",
  EVENT: "이벤트",
  MONETARY: "통화정책",
};
