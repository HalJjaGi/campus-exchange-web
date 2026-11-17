import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { NumberField } from "./NumberField";

function Harness({ initial = "" }: { initial?: string }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <NumberField label="가격" value={v} onChange={setV} />
      <output data-testid="raw">{v}</output>
    </>
  );
}

it("입력 중에도 쉼표가 붙고, 값은 쉼표 없이 전달된다", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.type(screen.getByLabelText("가격"), "1234567");
  expect(screen.getByLabelText("가격")).toHaveValue("1,234,567");
  expect(screen.getByTestId("raw")).toHaveTextContent("1234567");
});

it("전체 선택 후 입력하면 기존 값을 대체한다(이어 붙지 않는다)", async () => {
  const user = userEvent.setup();
  render(<Harness initial="12270" />);
  const input = screen.getByLabelText("가격");
  await user.tripleClick(input);
  await user.keyboard("12355");
  expect(input).toHaveValue("12,355");
});

it("붙여넣은 문자 섞인 값은 숫자만 남긴다", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const input = screen.getByLabelText("가격");
  await user.click(input);
  await user.paste("12,350P");
  expect(screen.getByTestId("raw")).toHaveTextContent("12350");
});
