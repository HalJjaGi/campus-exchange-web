import { Keyboard } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useLogin, useSession } from "@/features/auth/session";
import { userMessageOf } from "@/shared/api/errors";
import { Button } from "@/shared/ui/Button";
import { IconButton } from "@/shared/ui/IconButton";
import { ShortcutModal } from "@/shared/ui/ShortcutModal";
import { TextField } from "@/shared/ui/TextField";
import { toast } from "@/shared/ui/Toast";
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
  const [shortcutOpen, setShortcutOpen] = useState(false);

  const handleDemoLogin = useCallback(() => {
    setEmail("demo@campus.ac.kr");
    setPassword("campus2026");
    login.mutate(
      { email: "demo@campus.ac.kr", password: "campus2026" },
      {
        onSuccess: () => {
          toast.show("데모 계정으로 로그인했습니다.");
          navigate(next, { replace: true });
        },
      },
    );
  }, [login, navigate, next]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (e.metaKey || e.ctrlKey) return;

      const code = e.code;
      const key = e.key.toLowerCase();

      // ? 또는 / 키: 단축키 안내 창
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

      // D 키: 데모 계정 바로 로그인 (입력창 밖일 때)
      if (!isInput && !e.altKey && !e.shiftKey && (code === "KeyD" || key === "d" || key === "ㅇ")) {
        e.preventDefault();
        handleDemoLogin();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleDemoLogin]);

  if (session.data) return <Navigate to={next} replace />;

  return (
    <AuthLayout
      title="로그인"
      action={
        <IconButton label="단축키 안내 (?)" onClick={() => setShortcutOpen(true)}>
          <Keyboard size={18} aria-hidden />
        </IconButton>
      }
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
          busy={login.isPending}
          onClick={handleDemoLogin}
          title="단축키: D"
        >
          시연용 데모 계정 바로 로그인 (D)
        </Button>
      </form>
      <ShortcutModal open={shortcutOpen} onClose={() => setShortcutOpen(false)} />
    </AuthLayout>
  );
}
