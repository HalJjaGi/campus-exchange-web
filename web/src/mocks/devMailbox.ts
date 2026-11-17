/**
 * 개발용 메일함. 가짜 서버는 메일을 보내지 않으니, 보낸 인증번호를 화면 구석에 띄운다(시연용).
 * mock과 함께 개발 모드에서만 실리고 프로덕션 번들에는 없다. React 트리 밖에 직접 그린다.
 */

const ARRIVAL_DELAY_MS = 800;

let box: HTMLElement | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, style: Partial<CSSStyleDeclaration>, text?: string) {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  if (text !== undefined) node.textContent = text; // 이메일은 사용자 입력이라 innerHTML을 쓰지 않는다
  return node;
}

export function closeMail() {
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = null;
  box?.remove();
  box = null;
}

/** 메일이 도착한 것처럼 잠깐 뒤에 띄운다. 재발송하면 새 번호로 바뀐다 */
export function showMail(email: string, code: string) {
  closeMail();
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    box = el("aside", {
      position: "fixed",
      top: "var(--space-4)",
      right: "var(--space-4)",
      zIndex: "var(--z-toast)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-1)",
      minWidth: "240px",
      padding: "var(--space-3) var(--space-4)",
      borderRadius: "var(--radius-lg)",
      background: "var(--surface-inverse)",
      color: "var(--text-inverse)",
      boxShadow: "var(--shadow-float)",
      fontSize: "var(--text-sm)",
    });
    box.setAttribute("aria-label", "개발용 메일함");
    box.setAttribute("role", "status");

    const head = el("div", { display: "flex", justifyContent: "space-between", gap: "var(--space-3)", opacity: "0.7" });
    head.append(el("span", {}, "개발용 메일함 · 실제 메일은 가지 않아요"));
    const close = el(
      "button",
      { padding: "0", border: "0", background: "none", color: "inherit", font: "inherit", cursor: "pointer" },
      "닫기",
    );
    close.type = "button";
    close.addEventListener("click", closeMail);
    head.append(close);

    const codeLine = el(
      "strong",
      { fontSize: "var(--text-2xl)", lineHeight: "var(--leading-2xl)", letterSpacing: "0.2em" },
      code,
    );
    codeLine.className = "num";

    box.append(head, el("span", { wordBreak: "break-all" }, `${email} 으로 보낸 인증번호`), codeLine);
    document.body.append(box);
  }, ARRIVAL_DELAY_MS);
}
