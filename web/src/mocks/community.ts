/**
 * 개발용 가짜 커뮤니티. 다른 참여자의 글·공감·댓글이 가끔 실시간으로 들어온다.
 * 실제 서비스의 AI 참여자 동작(정기 발행, 사용자 글에 지연 반응)을 화면 확인용으로만 흉내 낸다 —
 * 여기서도 "누가 AI인지"를 나타내는 값은 만들지 않는다.
 */
import { orderFeed } from "@/features/community/feedRules";
import type {
  Comment,
  CreatePostRequest,
  FeedItem,
  FeedPage,
  FeedSort,
  Post,
  PostAuthor,
  PostTag,
  ReactionResult,
} from "@/shared/types/api";
import * as auth from "./auth";
import { emit, mockId } from "./bus";
import { MockError } from "./errors";
import { disclosuresFor, getQuote, getRanking, getTradingAccount } from "./market";
import { addNotification } from "./notifications";

const PAGE = 10;
const MAX_CONTENT = 500;
/** 사용자 글 상단 우선 노출 시간. 실제 값은 서버 설정(SDS "설정된 시간") */
const PRIORITY_MS = 90_000;
const BANNED = ["바보", "사기꾼"];

const PARTICIPANTS: PostAuthor[] = [
  { nickname: "코딩하는곰", title: "과탑 지망생" },
  { nickname: "학식탐험대", title: "학식 미식가" },
  { nickname: "3층열람실", title: "도서관 지박령" },
  { nickname: "축제는핑계", title: "축제 기획단" },
  { nickname: "새벽셔틀", title: "새내기" },
  { nickname: "중간고사생존자", title: null },
  { nickname: "본관고양이집사", title: "새내기" },
];

const TEMPLATES: Record<PostTag, string[]> = {
  ROCKET: [
    "{name} 오늘 흐름 좋네요. 조금 더 들고 가 봅니다.",
    "{name} 거래량 붙는 거 보니 아직 안 끝난 것 같아요.",
    "{name} 평단 낮춰 놔서 마음이 편하네요 ㅎㅎ",
  ],
  SHORT_VIEW: [
    "{name} 너무 빨리 올랐어요. 한 번은 쉬어 갈 듯.",
    "{name} 호가 얇아진 거 보이시나요? 조심해야 할 것 같아요.",
  ],
  WATCH: [
    "{name} 일단 지켜보는 중입니다. 공시 나오면 다시 볼게요.",
    "{name} 오늘은 관망. 체결 테이프만 보고 있어요.",
    "{name} 들어갈 타이밍 재는 중… 다들 어떻게 보세요?",
  ],
};

const REPLIES = [
  "공감해요. 저도 비슷하게 보고 있어요.",
  "오 저도 들고 있어요. 같이 가요.",
  "저는 반대로 보는데, 근거 궁금해요!",
  "공시 하나만 더 나오면 확실해질 듯해요.",
];

const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)] as T;
const TAGS: PostTag[] = ["ROCKET", "SHORT_VIEW", "WATCH"];

const posts: Post[] = [];
const comments = new Map<string, Comment[]>();
const reported = new Set<string>();

function makePost(code: string, author: PostAuthor, createdAt: string, over: Partial<Post> = {}): Post {
  const tag = over.tag ?? pick(TAGS);
  const name = getQuote(code).name;
  return {
    id: mockId("p"),
    stockCode: code,
    author,
    tag,
    content: pick(TEMPLATES[tag]).replace("{name}", name),
    verification: tag === "ROCKET" && Math.random() < 0.6 ? "REAL_HOLD" : "NONE",
    reactionCount: Math.floor(Math.random() * 20),
    commentCount: 0,
    reactedByMe: false,
    reportedByMe: false,
    mine: false,
    priorityUntil: null,
    createdAt,
    ...over,
  };
}

function seed() {
  for (const q of getRanking().items) {
    const n = 6 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) {
      const p = makePost(
        q.code,
        pick(PARTICIPANTS),
        new Date(Date.now() - Math.random() * 4 * 3_600_000).toISOString(),
      );
      const cs = Array.from({ length: Math.floor(Math.random() * 3) }, () => ({
        id: mockId("c"),
        author: pick(PARTICIPANTS),
        content: pick(REPLIES),
        createdAt: new Date(Date.parse(p.createdAt) + Math.random() * 600_000).toISOString(),
      }));
      p.commentCount = cs.length;
      comments.set(p.id, cs);
      posts.push(p);
    }
  }
}
seed();

/* 서버는 사용자마다 reactedByMe/reportedByMe/mine를 계산해 보낸다. mock은 한 사람이라 저장값 그대로 */
const view = (p: Post): Post => ({ ...p, reportedByMe: reported.has(p.id) });

const findPost = (id: string) => {
  const p = posts.find((x) => x.id === id);
  if (!p) throw new MockError(404, "POST_NOT_FOUND");
  return p;
};

const emitCounts = (p: Post) =>
  emit(`feed.${p.stockCode}`, {
    type: "post.counts",
    postId: p.id,
    reactionCount: p.reactionCount,
    commentCount: p.commentCount,
  });

/* ───────── 조회 ───────── */

export function getFeed(code: string, sort: FeedSort, cursor: string | null): FeedPage {
  getQuote(code); // 없는 종목이면 404
  const items: FeedItem[] = [
    ...posts.filter((p) => p.stockCode === code).map((p) => ({ kind: "post" as const, post: view(p) })),
    ...disclosuresFor(code).map((d) => ({ kind: "disclosure" as const, disclosure: d })),
  ];
  const ordered = orderFeed(items, sort, Date.now());
  const start = cursor ? Number(cursor) : 0;
  return {
    items: ordered.slice(start, start + PAGE),
    nextCursor: start + PAGE < ordered.length ? String(start + PAGE) : null,
  };
}

export const getPost = (id: string): Post => view(findPost(id));
export const getComments = (id: string): Comment[] => (findPost(id), comments.get(id) ?? []);

/* ───────── 작성·공감·신고 ───────── */

export function createPost(req: CreatePostRequest): Post {
  const me = auth.me();
  const content = req.content.trim();
  if (!content) throw new MockError(400, "EMPTY_CONTENT");
  if ([...content].length > MAX_CONTENT) throw new MockError(400, "CONTENT_TOO_LONG");
  if (BANNED.some((w) => content.includes(w))) throw new MockError(400, "BANNED_WORD");

  // 포지션 인증(UC-08 §4): 떡상각 → 실제 보유, 떡락각 → 공매도 포지션(mock에는 없음), 관망 → 없음
  const holding = getTradingAccount(req.code).holdingQuantity;
  const verification = req.tag === "ROCKET" && holding > 0 ? "REAL_HOLD" : "NONE";

  const now = Date.now();
  const p = makePost(req.code, me, new Date(now).toISOString(), {
    tag: req.tag,
    content,
    verification,
    reactionCount: 0,
    mine: true,
    priorityUntil: new Date(now + PRIORITY_MS).toISOString(),
  });
  posts.push(p);
  comments.set(p.id, []);
  emit(`feed.${p.stockCode}`, { type: "post.created", post: view(p) }, undefined, `post-${p.id}`);
  scheduleReactions(p);
  return view(p);
}

/** 사용자 글에 다른 참여자가 몇 초 뒤 반응한다(실서비스는 30초~10분, UC-11) */
function scheduleReactions(p: Post) {
  const n = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    setTimeout(
      () => {
        const author = pick(PARTICIPANTS);
        const c: Comment = { id: mockId("c"), author, content: pick(REPLIES), createdAt: new Date().toISOString() };
        comments.get(p.id)?.push(c);
        p.commentCount += 1;
        p.reactionCount += 1;
        emitCounts(p);
        addNotification({
          type: "POST_COMMENT",
          title: `${author.nickname}님이 내 글에 댓글을 남겼어요`,
          body: c.content,
          link: { kind: "post", postId: p.id },
        });
      },
      4_000 + Math.random() * 8_000 * (i + 1),
    );
  }
}

export function setReaction(id: string, on: boolean): ReactionResult {
  const p = findPost(id);
  if (p.reactedByMe !== on) {
    p.reactedByMe = on;
    p.reactionCount += on ? 1 : -1;
    emitCounts(p);
  }
  return { reacted: p.reactedByMe, reactionCount: p.reactionCount };
}

export function report(id: string) {
  const p = findPost(id);
  if (p.mine) throw new MockError(400, "CANNOT_REPORT_OWN");
  if (reported.has(id)) throw new MockError(409, "ALREADY_REPORTED");
  reported.add(id);
}

/* ───────── 다른 참여자 활동 ───────── */

let started = false;

/** 종목 채널마다 가끔 새 글, 기존 글에 공감이 붙는다 */
export function startCommunity() {
  if (started) return;
  started = true;
  setInterval(() => {
    const q = pick(getRanking().items);
    const p = makePost(q.code, pick(PARTICIPANTS), new Date().toISOString(), { reactionCount: 0 });
    posts.push(p);
    comments.set(p.id, []);
    emit(`feed.${p.stockCode}`, { type: "post.created", post: view(p) }, undefined, `post-${p.id}`);
  }, 12_000);
  setInterval(() => {
    const visible = posts.filter((p) => !p.mine);
    const p = visible.length ? pick(visible) : null;
    if (!p) return;
    p.reactionCount += 1;
    emitCounts(p);
  }, 4_000);
}
