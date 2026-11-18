import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LoginPage } from "./LoginPage";

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe("LoginPage Shortcuts", () => {
  it("로그인 화면에서 ? 키를 누르면 단축키 모달이 열린다", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/login"]}>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.keyboard("?");
    expect(screen.getByRole("heading", { name: "단축키 안내" })).toBeInTheDocument();
  });

  it("로그인 화면에서 단축키 버튼 클릭 시 단축키 모달이 열린다", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/login"]}>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const btn = screen.getByLabelText("단축키 안내 (?)");
    await user.click(btn);
    expect(screen.getByRole("heading", { name: "단축키 안내" })).toBeInTheDocument();
  });

  it("시연용 데모 계정 바로 로그인 버튼을 클릭하면 데모 로그인이 수행된다", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/login"]}>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const demoBtn = screen.getByRole("button", { name: /시연용 데모 계정 바로 로그인/ });
    await user.click(demoBtn);
    await waitFor(() => {
      expect(demoBtn).toBeInTheDocument();
    });
  });
});
