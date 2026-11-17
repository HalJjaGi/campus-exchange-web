import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useLogout, useSession } from "@/features/auth/session";
import s from "./AppLayout.module.css";

/** GNB 오른쪽 사용자 메뉴. 바깥을 누르거나 Esc면 닫힌다 */
export function UserMenu() {
  const { data: user } = useSession();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div className={s.userMenu} ref={root}>
      <button
        type="button"
        className={s.userButton}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {user.title && <span className={s.userTitle}>{user.title}</span>}
        <span className={s.userName}>{user.nickname}</span>
        <ChevronDown size={16} aria-hidden />
      </button>
      {open && (
        <ul id={menuId} className={s.menu}>
          <li>
            <button type="button" className={s.menuItem} onClick={() => logout.mutate()} disabled={logout.isPending}>
              로그아웃
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
