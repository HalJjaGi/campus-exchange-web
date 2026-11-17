import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import s from "./Modal.module.css";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** 가입 완료처럼 닫기 버튼 없이 행동 버튼으로만 닫는 경우 */
  dismissible?: boolean;
}

/** 네이티브 <dialog>로 포커스 트랩·ESC·배경 비활성을 처리한다 */
export function Modal({ open, onClose, title, children, footer, dismissible = true }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return createPortal(
    <dialog
      ref={ref}
      className={s.dialog}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
    >
      <div className={s.panel}>
        <header className={s.header}>
          <h2 id={titleId} className={s.title}>
            {title}
          </h2>
          {dismissible && (
            <IconButton label="닫기" size="sm" onClick={onClose}>
              <X size={18} />
            </IconButton>
          )}
        </header>
        <div className={s.body}>{children}</div>
        {footer && <footer className={s.footer}>{footer}</footer>}
      </div>
    </dialog>,
    document.body,
  );
}
