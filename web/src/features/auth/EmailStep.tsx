import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError, userMessageOf } from "@/shared/api/errors";
import { formatTime } from "@/shared/lib/format";
import { Button } from "@/shared/ui/Button";
import { Countdown } from "@/shared/ui/Countdown";
import { TextField } from "@/shared/ui/TextField";
import { emailIssue, isCompleteCode } from "./rules";
import { authDetailOf, useSendCode, useVerifyCode } from "./signup";
import s from "./auth.module.css";

interface Props {
  onVerified: (email: string, verificationToken: string) => void;
}

/** 1단계: 학교 메일 인증(UC-01 §1~2, SD-01) */
export function EmailStep({ onVerified }: Props) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<{ email: string; expiresAt: string } | null>(null);
  const [expired, setExpired] = useState(false);
  const send = useSendCode();
  const verify = useVerifyCode();

  const formatIssue = emailIssue(email);

  const requestCode = () => {
    const target = sent?.email ?? email.trim();
    send.mutate(target, {
      onSuccess: (r) => {
        setSent({ email: target, expiresAt: r.expiresAt });
        setExpired(false);
        setCode("");
        verify.reset();
      },
    });
  };

  const submitCode = (e: FormEvent) => {
    e.preventDefault();
    if (!sent || !isCompleteCode(code) || expired) return;
    verify.mutate(
      { email: sent.email, code },
      {
        onSuccess: (r) => onVerified(sent.email, r.verificationToken),
        onError: (err) => {
          if (err instanceof ApiError && err.code === "CODE_EXPIRED") setExpired(true);
        },
      },
    );
  };

  /* ── 메일 입력 ── */
  if (!sent) {
    const err = send.error;
    const registered = err instanceof ApiError && err.code === "EMAIL_ALREADY_REGISTERED";
    return (
      <form
        className={s.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim() && !formatIssue) requestCode();
        }}
      >
        <TextField
          label="학교 이메일"
          type="email"
          autoComplete="email"
          placeholder="name@school.ac.kr"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            send.reset();
          }}
          error={formatIssue ?? (err ? (lockedMessage(err) ?? userMessageOf(err)) : undefined)}
          hint="인증번호를 이 메일로 보내드려요."
        />
        {registered && (
          <p className={s.inlineLink}>
            <Link to="/login">로그인하러 가기</Link>
          </p>
        )}
        <Button
          type="submit"
          variant="action"
          size="lg"
          block
          busy={send.isPending}
          disabled={!email.trim() || !!formatIssue}
        >
          인증번호 받기
        </Button>
      </form>
    );
  }

  /* ── 인증번호 입력 ── */
  const vErr = verify.error;
  const locked = vErr ? lockedMessage(vErr) : null;
  const mismatch = vErr instanceof ApiError && vErr.code === "CODE_MISMATCH";
  const remaining = authDetailOf(vErr).remainingAttempts;
  const codeError = locked
    ? locked
    : mismatch
      ? `인증번호가 맞지 않아요.${remaining !== undefined ? ` ${remaining}회 남았어요.` : ""}`
      : expired
        ? "인증번호가 만료됐어요. 새로 받아 주세요."
        : vErr
          ? userMessageOf(vErr)
          : undefined;
  const sendErr = send.error ? (lockedMessage(send.error) ?? userMessageOf(send.error)) : null;

  return (
    <form className={s.form} onSubmit={submitCode}>
      <p className={s.sentTo}>
        <strong>{sent.email}</strong>로 보낸 6자리 숫자를 입력해 주세요.{" "}
        <button
          type="button"
          className={s.textButton}
          onClick={() => {
            setSent(null);
            setCode("");
            verify.reset();
            send.reset();
          }}
        >
          메일 바꾸기
        </button>
      </p>
      <TextField
        label="인증번호"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => {
          setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
          if (mismatch) verify.reset();
        }}
        disabled={!!locked}
        error={codeError}
        trailing={!expired && !locked ? <Countdown until={sent.expiresAt} onExpire={() => setExpired(true)} /> : null}
      />
      <div className={s.row}>
        <Button
          type="submit"
          variant={expired ? "secondary" : "action"}
          size="lg"
          block
          busy={verify.isPending}
          disabled={!isCompleteCode(code) || expired || !!locked}
        >
          확인
        </Button>
        <Button
          variant={expired ? "action" : "secondary"}
          size="lg"
          block
          busy={send.isPending}
          disabled={!!locked}
          onClick={requestCode}
        >
          다시 받기
        </Button>
      </div>
      {sendErr && <p className={s.formError}>{sendErr}</p>}
      <p className={s.help}>다시 받으면 이전 인증번호는 쓸 수 없어요. 3번 틀리면 5분 동안 잠겨요.</p>
    </form>
  );
}

/** 잠금 응답이면 잠금 해제 시각을 넣은 문구 */
function lockedMessage(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.code !== "EMAIL_LOCKED") return null;
  const until = authDetailOf(err).lockedUntil;
  return until ? `여러 번 틀려서 ${formatTime(until)}까지 잠겼어요.` : "여러 번 틀려서 잠시 잠겼어요.";
}
