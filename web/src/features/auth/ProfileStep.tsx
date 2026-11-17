import { useState, type FormEvent } from "react";
import { ApiError, userMessageOf } from "@/shared/api/errors";
import type { SignupResult } from "@/shared/types/api";
import { Button } from "@/shared/ui/Button";
import { ErrorBlock, Skeleton } from "@/shared/ui/States";
import { TextField } from "@/shared/ui/TextField";
import { NICKNAME_MAX, nicknameLength, passwordIssue } from "./rules";
import { useNicknameCheck, useSignup, useTitles } from "./signup";
import s from "./auth.module.css";

interface Props {
  verificationToken: string;
  onDone: (result: SignupResult) => void;
  /** 인증이 만료돼 처음부터 다시 해야 할 때 */
  onRestart: () => void;
}

/** 2단계: 닉네임·비밀번호·초기 칭호(UC-01 §3~5) */
export function ProfileStep({ verificationToken, onDone, onRestart }: Props) {
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [titleId, setTitleId] = useState<string | null>(null);
  const titles = useTitles();
  const check = useNicknameCheck(nickname);
  const signup = useSignup(onDone);

  const pwIssue = passwordIssue(password);
  const confirmIssue = confirm && confirm !== password ? "비밀번호가 서로 달라요." : null;
  const serverTaken = signup.error instanceof ApiError && signup.error.code === "NICKNAME_TAKEN";

  const nicknameError =
    check.state === "invalid"
      ? check.message
      : check.state === "taken" || serverTaken
        ? "이미 쓰고 있는 닉네임이에요."
        : undefined;
  const nicknameSuccess = check.state === "available" && !serverTaken ? "쓸 수 있는 닉네임이에요." : undefined;
  const nicknameHint =
    check.state === "checking"
      ? "확인하는 중이에요…"
      : check.state === "error"
        ? "지금은 중복 확인을 못 했어요. 가입할 때 다시 확인해요."
        : `${nicknameLength(nickname)}/${NICKNAME_MAX}자`;

  const ready =
    (check.state === "available" || check.state === "error") &&
    !serverTaken &&
    !!password &&
    !pwIssue &&
    confirm === password &&
    !!titleId;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready || !titleId) return;
    signup.submit({ verificationToken, nickname: nickname.trim(), password, titleId });
  };

  const expiredVerification = signup.error instanceof ApiError && signup.error.code === "VERIFICATION_EXPIRED";

  return (
    <form className={s.form} onSubmit={submit}>
      <TextField
        label="닉네임"
        autoComplete="nickname"
        value={nickname}
        onChange={(e) => {
          setNickname(e.target.value);
          if (serverTaken) signup.reset();
        }}
        error={nicknameError}
        success={nicknameSuccess}
        hint={nicknameHint}
      />
      <TextField
        label="비밀번호"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={pwIssue ?? undefined}
        hint="8자 이상, 영문과 숫자를 함께 넣어 주세요."
      />
      <TextField
        label="비밀번호 확인"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={confirmIssue ?? undefined}
      />

      <fieldset className={s.titles}>
        <legend className={s.legend}>처음 달 칭호</legend>
        {titles.data ? (
          <div className={s.titleGrid} role="radiogroup" aria-label="처음 달 칭호">
            {titles.data.map((t) => (
              <label key={t.id} className={s.titleOption} data-selected={titleId === t.id || undefined}>
                <input
                  type="radio"
                  name="title"
                  value={t.id}
                  checked={titleId === t.id}
                  onChange={() => setTitleId(t.id)}
                  className="visually-hidden"
                />
                {t.name}
              </label>
            ))}
          </div>
        ) : titles.isError ? (
          <ErrorBlock message="칭호 목록을 불러오지 못했어요." onRetry={() => void titles.refetch()} />
        ) : (
          <Skeleton height={72} />
        )}
      </fieldset>

      {expiredVerification ? (
        <div className={s.formError} role="alert">
          {userMessageOf(signup.error)}{" "}
          <button type="button" className={s.textButton} onClick={onRestart}>
            처음으로
          </button>
        </div>
      ) : (
        signup.error &&
        !serverTaken && (
          <p className={s.formError} role="alert">
            {userMessageOf(signup.error)}
          </p>
        )
      )}

      <Button type="submit" variant="action" size="lg" block busy={signup.isPending} disabled={!ready}>
        가입 완료
      </Button>
    </form>
  );
}
