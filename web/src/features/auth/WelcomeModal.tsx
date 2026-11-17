import { formatAnnualRate, formatIndex, formatPoints } from "@/shared/lib/format";
import { useCountUp } from "@/shared/lib/motion";
import type { SignupResult } from "@/shared/types/api";
import { Chip } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Modal } from "@/shared/ui/Modal";
import { ChangeRate } from "@/shared/ui/Numbers";
import { Sparkline } from "@/shared/ui/Sparkline";
import s from "./auth.module.css";

/**
 * 3단계: 가입 완료(UC-01 §7). 금액·금리·지수는 모두 가입 응답의 서버 값이다.
 * 시장 데이터가 없으면(welcome = null) 가입은 그대로 두고 안내만 바꾼다.
 */
export function WelcomeModal({ result, onStart }: { result: SignupResult; onStart: () => void }) {
  const grant = useCountUp(Number(result.initialGrant));
  const w = result.welcome;

  return (
    <Modal
      open
      dismissible={false}
      onClose={onStart}
      title={`${result.user.nickname}님, 가입을 환영해요`}
      footer={
        <Button variant="action" size="lg" block onClick={onStart} autoFocus>
          시작하기
        </Button>
      }
    >
      <div className={s.welcome}>
        <p className={s.grantLabel}>초기 자산</p>
        <p className={`num ${s.grant}`} aria-label={`초기 자산 ${formatPoints(result.initialGrant)}`}>
          {formatPoints(grant)}
        </p>

        {w ? (
          <>
            <div className={s.chips}>
              <Chip>
                기준금리 <strong className="num">{formatAnnualRate(w.policy.baseRate)}</strong>
              </Chip>
              <Chip>
                예수금 이자율 <strong className="num">{formatAnnualRate(w.policy.depositRate)}</strong>
              </Chip>
            </div>
            <div className={s.market}>
              <div className={s.marketHead}>
                <span>종합지수</span>
                <span className={`num ${s.marketValue}`}>{formatIndex(w.index.value)}</span>
                <ChangeRate ratio={w.index.changeRate} />
              </div>
              {/* 당일 데이터가 두 점 이상일 때만 그린다(값을 지어내지 않는다) */}
              {w.index.intraday.length >= 2 && (
                <Sparkline points={w.index.intraday} width={400} height={56} label="종합지수 당일 추이" />
              )}
              <p className={s.marketCaption}>시장은 이미 움직이고 있습니다</p>
            </div>
            <p className={s.headline}>{w.headline}</p>
          </>
        ) : (
          <p className={s.help}>지금은 시장 정보를 불러오지 못했어요. 대시보드에서 바로 확인할 수 있어요.</p>
        )}
      </div>
    </Modal>
  );
}
