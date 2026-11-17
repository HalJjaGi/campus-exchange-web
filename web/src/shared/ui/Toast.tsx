import { CircleAlert, CircleCheck } from "lucide-react";
import { useEffect } from "react";
import { create } from "zustand";
import { cx } from "@/shared/lib/cx";
import s from "./Toast.module.css";

type ToastTone = "neutral" | "positive" | "danger";

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
const MAX_VISIBLE = 3;

const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (message, tone = "neutral") =>
    set((st) => ({ items: [...st.items, { id: ++seq, tone, message }].slice(-MAX_VISIBLE) })),
  dismiss: (id) => set((st) => ({ items: st.items.filter((t) => t.id !== id) })),
}));

/** 컴포넌트 밖(mutation 콜백 등)에서도 부를 수 있다 */
export const toast = {
  show: (message: string) => useToastStore.getState().push(message, "neutral"),
  success: (message: string) => useToastStore.getState().push(message, "positive"),
  error: (message: string) => useToastStore.getState().push(message, "danger"),
};

const DURATION_MS = 4000;

function ToastRow({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((st) => st.dismiss);
  useEffect(() => {
    const t = setTimeout(() => dismiss(item.id), DURATION_MS);
    return () => clearTimeout(t);
  }, [item.id, dismiss]);

  const Icon = item.tone === "danger" ? CircleAlert : item.tone === "positive" ? CircleCheck : null;

  return (
    <li className={cx(s.toast, s[item.tone])}>
      {Icon && <Icon size={16} aria-hidden className={s.icon} />}
      <span>{item.message}</span>
    </li>
  );
}

export function ToastViewport() {
  const items = useToastStore((st) => st.items);
  return (
    <ol className={s.viewport} aria-live="polite">
      {items.map((t) => (
        <ToastRow key={t.id} item={t} />
      ))}
    </ol>
  );
}
