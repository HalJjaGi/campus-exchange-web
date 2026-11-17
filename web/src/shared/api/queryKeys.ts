/** 여러 feature가 함께 쓰거나 무효화하는 쿼리 키. feature끼리 import하지 않도록 여기에 둔다 */
export const sharedKeys = {
  wallet: ["me", "wallet"] as const,
};

/** 로그인 사용자. null이면 로그아웃 상태 */
export const sessionKey = ["session"] as const;
