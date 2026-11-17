import { CircleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ApiError, userMessageOf } from "@/shared/api/errors";
import type { MyProfile } from "@/shared/types/api";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Modal } from "@/shared/ui/Modal";
import { ErrorBlock, Skeleton } from "@/shared/ui/States";
import { TextField } from "@/shared/ui/TextField";
import { toast } from "@/shared/ui/Toast";
import { useProfile, useUpdateNickname } from "./profile";
import { NICKNAME_MAX, nicknameLength } from "./rules";
import { useNicknameCheck } from "./signup";
import s from "./profile.module.css";

const joinedDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};

/** 마이페이지 머리 — 닉네임·칭호·학교·가입일(SCR-06 §2). 메일 주소 등 계정 식별 정보는 고칠 수 없다 */
export function ProfileCard() {
  const { data, isError, isFetching, refetch } = useProfile();
  const [editing, setEditing] = useState(false);

  if (!data) {
    return isError ? (
      <ErrorBlock message="프로필을 불러오지 못했어요." onRetry={() => void refetch()} retrying={isFetching} />
    ) : (
      <div className={s.card}>
        <Skeleton width={200} height="var(--leading-2xl)" />
        <Skeleton width={280} />
      </div>
    );
  }

  return (
    <div className={s.card}>
      <div className={s.identity}>
        <h1 className={s.nickname}>{data.nickname}</h1>
        {data.title && <Badge tone="outline">{data.title}</Badge>}
        {data.status === "RESTRICTED" && (
          <Badge tone="danger" icon={<CircleAlert size={12} aria-hidden />}>
            이용 제한 중
          </Badge>
        )}
      </div>
      <p className={s.meta}>
        <span>{data.schoolDomain}</span>
        <span aria-hidden>·</span>
        <span>
          <span className="num">{joinedDate(data.joinedAt)}</span> 가입
        </span>
      </p>
      <Button size="sm" variant="ghost" className={s.edit} onClick={() => setEditing(true)}>
        닉네임 변경
      </Button>
      {editing && <NicknameDialog profile={data} onClose={() => setEditing(false)} />}
    </div>
  );
}

function NicknameDialog({ profile, onClose }: { profile: MyProfile; onClose: () => void }) {
  const [value, setValue] = useState(profile.nickname);
  const unchanged = value.trim() === profile.nickname;
  const check = useNicknameCheck(unchanged ? "" : value);
  const update = useUpdateNickname(() => {
    toast.success("닉네임을 바꿨어요.");
    onClose();
  });
  const serverTaken = update.error instanceof ApiError && update.error.code === "NICKNAME_TAKEN";

  const error =
    check.state === "invalid"
      ? check.message
      : check.state === "taken" || serverTaken
        ? "이미 쓰고 있는 닉네임이에요."
        : update.isError
          ? userMessageOf(update.error)
          : undefined;
  const hint = unchanged
    ? "지금 쓰는 닉네임이에요."
    : check.state === "checking"
      ? "확인하는 중이에요…"
      : check.state === "error"
        ? "지금은 중복 확인을 못 했어요. 저장할 때 다시 확인해요."
        : `${nicknameLength(value)}/${NICKNAME_MAX}자`;
  const ready = !unchanged && (check.state === "available" || check.state === "error") && !serverTaken;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ready) update.mutate({ nickname: value.trim() });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="닉네임 변경"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button variant="action" type="submit" form="nickname-form" disabled={!ready} busy={update.isPending}>
            변경하기
          </Button>
        </>
      }
    >
      <form id="nickname-form" onSubmit={submit}>
        <TextField
          label="새 닉네임"
          autoComplete="nickname"
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (update.isError) update.reset();
          }}
          error={error}
          success={check.state === "available" && !serverTaken ? "쓸 수 있는 닉네임이에요." : undefined}
          hint={hint}
        />
      </form>
    </Modal>
  );
}
