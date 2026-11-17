import { useId, useState } from "react";
import { cx } from "@/shared/lib/cx";
import { userMessageOf } from "@/shared/api/errors";
import type { PostTag } from "@/shared/types/api";
import { Button } from "@/shared/ui/Button";
import { MAX_CONTENT, contentLength } from "./feedRules";
import { TAG_LABEL } from "./PostCard";
import { useCreatePost } from "./queries";
import s from "./community.module.css";

const TAGS: PostTag[] = ["ROCKET", "SHORT_VIEW", "WATCH"];
const WARN_AT = 20;

/** 글 작성(UC-08 §2~3). 태그 1개 필수, 500자를 넘으면 등록할 수 없다 */
export function Composer({ code, stockName }: { code: string; stockName: string }) {
  const [tag, setTag] = useState<PostTag | null>(null);
  const [content, setContent] = useState("");
  const create = useCreatePost(() => {
    setContent("");
    setTag(null);
  });
  const textId = useId();
  const counterId = useId();

  const length = contentLength(content);
  const over = length > MAX_CONTENT;
  const left = MAX_CONTENT - length;
  const ready = !!tag && content.trim().length > 0 && !over && !create.isPending;

  return (
    <form
      className={s.composer}
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || !tag) return;
        create.mutate({ code, tag, content: content.trim() });
      }}
    >
      <div className={s.tagPicker} role="radiogroup" aria-label="태그">
        {TAGS.map((t) => (
          <label key={t} className={s.tagOption} data-selected={tag === t || undefined}>
            <input
              type="radio"
              name={`tag-${code}`}
              value={t}
              checked={tag === t}
              onChange={() => setTag(t)}
              className="visually-hidden"
            />
            {TAG_LABEL[t]}
          </label>
        ))}
      </div>
      <label htmlFor={textId} className="visually-hidden">
        {stockName}에 대한 글
      </label>
      <textarea
        id={textId}
        className={cx(s.textarea, over && s.textareaOver)}
        rows={3}
        placeholder={`${stockName} 이야기를 남겨 보세요`}
        value={content}
        aria-describedby={counterId}
        aria-invalid={over || undefined}
        onChange={(e) => {
          setContent(e.target.value);
          if (create.isError) create.reset();
        }}
      />
      <div className={s.composerFoot}>
        <span
          id={counterId}
          className={cx("num", s.counter, left <= WARN_AT && s.counterWarn, over && s.counterOver)}
          aria-live={left <= WARN_AT ? "polite" : undefined}
        >
          {over ? `${-left}자 넘었어요` : `${length} / ${MAX_CONTENT}`}
        </span>
        {create.error && (
          <span className={s.composerError} role="alert">
            {userMessageOf(create.error)}
          </span>
        )}
        <Button type="submit" variant="action" busy={create.isPending} disabled={!ready && !create.isPending}>
          올리기
        </Button>
      </div>
      {!tag && content.trim() && <p className={s.composerHint}>태그를 하나 골라 주세요.</p>}
    </form>
  );
}
