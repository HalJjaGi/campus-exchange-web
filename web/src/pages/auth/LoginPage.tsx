import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useLogin, useSession } from "@/features/auth/session";
import { userMessageOf } from "@/shared/api/errors";
import { Button } from "@/shared/ui/Button";
import { TextField } from "@/shared/ui/TextField";
import { AuthLayout } from "./AuthLayout";
import s from "./LoginPage.module.css";

/** 로그인 후 돌아갈 경로. 외부 주소로는 보내지 않는다 */
const safeNext = (next: string | null) => (next && next.startsWith("/") && !next.startsWith("//") ? next : "/");

export function LoginPage() {
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const navigate = useNavigate();
  const session = useSession();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (session.data) return <Navigate to={next} replace />;

  return (
    <AuthLayout
      title="로그인"
      footer={
        <>
          처음이라면 <Link to="/signup">학교 메일로 가입</Link>
        </>
      }
    >
      <form
        className={s.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (!email || !password) return;
          login.mutate({ email: email.trim(), password }, { onSuccess: () => navigate(next, { replace: true }) });
        }}
      >
        <TextField
          label="학교 이메일"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            login.reset();
          }}
        />
        <TextField
          label="비밀번호"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            login.reset();
          }}
          error={login.error ? userMessageOf(login.error) : undefined}
        />
        <Button type="submit" variant="action" size="lg" block busy={login.isPending} disabled={!email || !password}>
          로그인
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="md"
          block
          onClick={() => {
            setEmail("demo@campus.ac.kr");
            setPassword("campus2026");
          }}
        >
          시연용 데모 계정 자동 입력
        </Button>
      </form>
    </AuthLayout>
  );
}
