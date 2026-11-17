import { emailIssue, isCompleteCode, nicknameIssue, passwordIssue } from "./rules";

describe("emailIssue", () => {
  it("비어 있으면 아직 안내하지 않는다", () => expect(emailIssue("")).toBeNull());
  it("형식", () => expect(emailIssue("abc")).toBe("이메일 형식이 아니에요."));
  it(".ac.kr만 허용", () => {
    expect(emailIssue("me@gmail.com")).toBe("학교 메일(.ac.kr)로만 가입할 수 있어요.");
    expect(emailIssue("me@cs.campus.AC.KR")).toBeNull();
  });
});

describe("nicknameIssue", () => {
  it("한글 2자는 통과", () => expect(nicknameIssue("새싹")).toBeNull());
  it("1자·13자는 거부", () => {
    expect(nicknameIssue("a")).toBe("닉네임은 2~12자로 정해 주세요.");
    expect(nicknameIssue("가나다라마바사아자차카타파")).toBe("닉네임은 2~12자로 정해 주세요.");
  });
  it("공백 거부", () => expect(nicknameIssue("새 내기")).toBe("닉네임에 공백은 쓸 수 없어요."));
});

describe("passwordIssue", () => {
  it("길이", () => expect(passwordIssue("ab12")).toBe("비밀번호는 8~64자로 정해 주세요."));
  it("영문·숫자 조합", () => {
    expect(passwordIssue("abcdefgh")).toBe("영문과 숫자를 모두 넣어 주세요.");
    expect(passwordIssue("campus2026")).toBeNull();
  });
});

it("인증번호는 6자리 숫자", () => {
  expect(isCompleteCode("123456")).toBe(true);
  expect(isCompleteCode("12345")).toBe(false);
  expect(isCompleteCode("12a456")).toBe(false);
});
