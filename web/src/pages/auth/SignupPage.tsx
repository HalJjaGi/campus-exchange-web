import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmailStep } from "@/features/auth/EmailStep";
import { ProfileStep } from "@/features/auth/ProfileStep";
import { switchSession } from "@/features/auth/session";
import { WelcomeModal } from "@/features/auth/WelcomeModal";
import type { SignupResult } from "@/shared/types/api";
import { AuthLayout } from "./AuthLayout";

type Step = { kind: "email" } | { kind: "profile"; token: string } | { kind: "done"; result: SignupResult };

/** S-01 가입 마법사: 메일 인증 → 프로필 → 완료 모달 */
export function SignupPage() {
  const [step, setStep] = useState<Step>({ kind: "email" });
  const navigate = useNavigate();
  const qc = useQueryClient();

  if (step.kind === "email") {
    return (
      <AuthLayout
        step="1 / 3"
        title="학교 메일로 시작하기"
        footer={
          <>
            이미 가입했나요? <Link to="/login">로그인</Link>
          </>
        }
      >
        <EmailStep onVerified={(_email, token) => setStep({ kind: "profile", token })} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout step={step.kind === "profile" ? "2 / 3" : "3 / 3"} title="프로필 정하기">
      {step.kind === "profile" ? (
        <ProfileStep
          verificationToken={step.token}
          onDone={(result) => setStep({ kind: "done", result })}
          onRestart={() => setStep({ kind: "email" })}
        />
      ) : (
        <WelcomeModal
          result={step.result}
          onStart={() => {
            // 가입 응답으로 세션이 발급됐다. 로그인 중이던 다른 계정이 있었다면 그 데이터를 버린다
            switchSession(qc, step.result.user);
            navigate("/", { replace: true });
          }}
        />
      )}
    </AuthLayout>
  );
}
