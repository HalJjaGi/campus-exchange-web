import { Modal } from "./Modal";
import s from "./ShortcutModal.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ShortcutModal({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="단축키 안내">
      <div className={s.container}>
        <section className={s.section}>
          <h3 className={s.sectionTitle}>화면 이동 (내비게이션)</h3>
          <ul className={s.list}>
            <li className={s.row}>
              <span className={s.desc}>대시보드</span>
              <div className={s.keys}>
                <kbd className={s.kbd}>1</kbd>
                <span className={s.or}>또는</span>
                <kbd className={s.kbd}>Alt</kbd>
                <kbd className={s.kbd}>1</kbd>
              </div>
            </li>
            <li className={s.row}>
              <span className={s.desc}>거래 화면</span>
              <div className={s.keys}>
                <kbd className={s.kbd}>2</kbd>
                <span className={s.or}>또는</span>
                <kbd className={s.kbd}>Alt</kbd>
                <kbd className={s.kbd}>2</kbd>
              </div>
            </li>
            <li className={s.row}>
              <span className={s.desc}>커뮤니티</span>
              <div className={s.keys}>
                <kbd className={s.kbd}>3</kbd>
                <span className={s.or}>또는</span>
                <kbd className={s.kbd}>Alt</kbd>
                <kbd className={s.kbd}>3</kbd>
              </div>
            </li>
            <li className={s.row}>
              <span className={s.desc}>오락실</span>
              <div className={s.keys}>
                <kbd className={s.kbd}>4</kbd>
                <span className={s.or}>또는</span>
                <kbd className={s.kbd}>Alt</kbd>
                <kbd className={s.kbd}>4</kbd>
              </div>
            </li>
            <li className={s.row}>
              <span className={s.desc}>마이페이지</span>
              <div className={s.keys}>
                <kbd className={s.kbd}>5</kbd>
                <span className={s.or}>또는</span>
                <kbd className={s.kbd}>Alt</kbd>
                <kbd className={s.kbd}>5</kbd>
              </div>
            </li>
          </ul>
        </section>

        <section className={s.section}>
          <h3 className={s.sectionTitle}>주문 / 거래 (거래 화면)</h3>
          <ul className={s.list}>
            <li className={s.row}>
              <span className={s.desc}>매수 / 매도 탭 전환</span>
              <div className={s.keys}>
                <kbd className={s.kbd}>B</kbd>
                <kbd className={s.kbd}>S</kbd>
              </div>
            </li>
            <li className={s.row}>
              <span className={s.desc}>지정가 / 시장가 선택</span>
              <div className={s.keys}>
                <kbd className={s.kbd}>L</kbd>
                <kbd className={s.kbd}>M</kbd>
              </div>
            </li>
            <li className={s.row}>
              <span className={s.desc}>가격 / 수량 입력창 포커스</span>
              <div className={s.keys}>
                <kbd className={s.kbd}>P</kbd>
                <kbd className={s.kbd}>Q</kbd>
              </div>
            </li>
            <li className={s.row}>
              <span className={s.desc}>수량 비율 설정 (10% / 25% / 50% / MAX)</span>
              <div className={s.keys}>
                <kbd className={s.kbd}>1</kbd>
                <kbd className={s.kbd}>2</kbd>
                <kbd className={s.kbd}>3</kbd>
                <kbd className={s.kbd}>4</kbd>
              </div>
            </li>
            <li className={s.row}>
              <span className={s.desc}>가격 / 수량 호가 조절</span>
              <div className={s.keys}>
                <kbd className={s.kbd}>↑</kbd>
                <kbd className={s.kbd}>↓</kbd>
              </div>
            </li>
            <li className={s.row}>
              <span className={s.desc}>주문 전송</span>
              <div className={s.keys}>
                <kbd className={s.kbd}>Enter</kbd>
              </div>
            </li>
          </ul>
        </section>

        <section className={s.section}>
          <h3 className={s.sectionTitle}>공통</h3>
          <ul className={s.list}>
            <li className={s.row}>
              <span className={s.desc}>단축키 안내 창 열기 / 닫기</span>
              <div className={s.keys}>
                <kbd className={s.kbd}>?</kbd>
                <span className={s.or}>또는</span>
                <kbd className={s.kbd}>/</kbd>
              </div>
            </li>
            <li className={s.row}>
              <span className={s.desc}>입력창 벗어나기 / 모달 닫기</span>
              <div className={s.keys}>
                <kbd className={s.kbd}>Esc</kbd>
              </div>
            </li>
          </ul>
        </section>

        <p className={s.tip}>* 한글(두벌식) 및 영문 자판 상태와 무관하게 모두 동작해요.</p>
      </div>
    </Modal>
  );
}
