import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ShortcutModal } from "./ShortcutModal";

function TestWrapper() {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        열기
      </button>
      <ShortcutModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

describe("ShortcutModal", () => {
  it("단축키 안내 창이 열리고 주요 단축키 항목들이 렌더링된다", () => {
    render(<TestWrapper />);
    expect(screen.getByRole("heading", { name: "단축키 안내" })).toBeInTheDocument();
    expect(screen.getByText("대시보드")).toBeInTheDocument();
    expect(screen.getByText("매수 / 매도 탭 전환")).toBeInTheDocument();
    expect(screen.getByText("지정가 / 시장가 선택")).toBeInTheDocument();
    expect(screen.getByText("주문 전송")).toBeInTheDocument();
  });

  it("닫기 버튼을 누르면 onClose가 호출된다", async () => {
    const user = userEvent.setup();
    render(<TestWrapper />);
    const closeBtn = screen.getByRole("button", { name: "닫기" });
    await user.click(closeBtn);
    expect(screen.queryByRole("heading", { name: "단축키 안내" })).not.toBeInTheDocument();
  });
});
