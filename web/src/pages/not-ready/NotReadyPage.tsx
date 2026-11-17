import { Link } from "react-router-dom";
import { EmptyState } from "@/shared/ui/States";

/** 아직 구현 단계에 들어가지 않은 화면. 계획 §5 순서대로 교체한다 */
export function NotReadyPage({ name }: { name: string }) {
  return (
    <EmptyState
      message={`${name} 화면은 아직 만들고 있어요.`}
      action={<Link to="/dev/ui">컴포넌트 확인 페이지로 이동</Link>}
    />
  );
}
