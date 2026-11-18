import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RealtimeClient } from "@/shared/realtime/RealtimeClient";
import { RealtimeProvider } from "@/shared/realtime/RealtimeProvider";
import { AppLayout } from "./AppLayout";

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const mockRealtime = new RealtimeClient(() => ({
  send: vi.fn(),
  close: vi.fn(),
  onopen: null,
  onclose: null,
  onmessage: null,
}));

describe("AppLayout Keyboard Shortcuts", () => {
  it("GNB 단축키 버튼 클릭 시 모달이 열린다", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={qc}>
        <RealtimeProvider client={mockRealtime}>
          <MemoryRouter initialEntries={["/"]}>
            <AppLayout />
          </MemoryRouter>
        </RealtimeProvider>
      </QueryClientProvider>,
    );

    const btn = screen.getByLabelText("단축키 안내 (?)");
    await user.click(btn);
    expect(screen.getByRole("heading", { name: "단축키 안내" })).toBeInTheDocument();
  });

  it("? 키를 누르면 단축키 모달이 열린다", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={qc}>
        <RealtimeProvider client={mockRealtime}>
          <MemoryRouter initialEntries={["/"]}>
            <AppLayout />
          </MemoryRouter>
        </RealtimeProvider>
      </QueryClientProvider>,
    );

    await user.keyboard("?");
    expect(screen.getByRole("heading", { name: "단축키 안내" })).toBeInTheDocument();
  });
});
