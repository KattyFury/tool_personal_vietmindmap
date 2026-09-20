import { BASE_GAP, BOX_W, GAP_DECAY, defaultBoxHeight } from "./constants";
import type { Direction, MindNode } from "./types";

/**
 * Khoảng hở mép parent → mép child (không liên quan độ dài line).
 * Dùng chung 1 công thức (× decay theo level) cho MỌI cặp parent-child —
 * mother→child hay child→child (cháu) đều đồng bộ, chỉ khác độ sâu.
 */
export const EDGE_GAP = 80; // bội số 8
export const EDGE_GAP_VERTICAL = 144; // bội số 8, gần nhất với 140 cũ

/** Hở mép giữa 2 sibling / 2 subtree kề nhau (cộng thêm vào size khi xếp) */
export const SIBLING_EDGE_GAP = 32; // bội số 8, gần nhất với 36 cũ


export function isRootNode(node: MindNode): boolean {
  return node.parentId === null || node.level === 0;
}

/** Box GROW theo nội dung — root/child cùng size, h lấy từ node.h đo được (fallback default). */
export function nodeBoxSize(node: MindNode): { w: number; h: number } {
  return { w: BOX_W, h: node.h ?? defaultBoxHeight() };
}

/**
 * Khoảng cách TÂM–TÂM giữa siblings cùng hướng (leaf, không tính subtree).
 * - Trên/dưới: xếp ngang → phải ≥ BOX_W + hở (trước dùng BASE_GAP=120 < BOX_W → chồng box)
 * - Trái/phải: xếp dọc → ≥ defaultBoxHeight + hở (hàm này không dùng height thật per-node,
 *   chỉ 1 ước lượng chung — spacing thật giữa sibling nằm ở reflowSiblings/subtreeBounds).
 */
export function siblingCenterGap(
  direction: Direction,
  level: number
): number {
  const decay = Math.pow(GAP_DECAY, Math.max(0, level - 1));
  if (direction === "up" || direction === "down") {
    return (BOX_W + SIBLING_EDGE_GAP) * decay;
  }
  return (defaultBoxHeight() + SIBLING_EDGE_GAP) * decay;
}

/** @deprecated dùng siblingCenterGap */
export function gapForLevel(level: number): number {
  return BASE_GAP * Math.pow(GAP_DECAY, Math.max(0, level - 1));
}

/** Hở mép giữa hai subtree kề nhau (cùng parent + hướng) */
function siblingEdgeGap(level: number): number {
  const decay = Math.pow(GAP_DECAY, Math.max(0, level - 1));
  // Sàn tối thiểu để deep level không bị dính box
  return Math.max(24, SIBLING_EDGE_GAP * decay);
}

export function branchOffset(
  direction: Direction,
  parent: MindNode,
  level: number
) {
  const p = nodeBoxSize(parent);
  const c = { w: BOX_W, h: defaultBoxHeight() };
  const decay = Math.pow(GAP_DECAY, Math.max(0, level - 1));
  const gapH = EDGE_GAP * decay;
  const gapV = EDGE_GAP_VERTICAL * decay;
  const dx = p.w / 2 + c.w / 2 + gapH;
  const dy = p.h / 2 + c.h / 2 + gapV;

  switch (direction) {
    case "up":
      return { x: 0, y: -dy };
    case "down":
      return { x: 0, y: dy };
    case "left":
      return { x: -dx, y: 0 };
    case "right":
      return { x: dx, y: 0 };
  }
}

export function opposite(dir: Direction): Direction {
  switch (dir) {
    case "up":
      return "down";
    case "down":
      return "up";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}

export function childrenOf(
  nodes: Record<string, MindNode>,
  parentId: string,
  direction?: Direction
): MindNode[] {
  return Object.values(nodes)
    .filter(
      (n) =>
        n.parentId === parentId &&
        (direction === undefined || n.direction === direction)
    )
    .sort((a, b) => {
      const ao = a.siblingOrder ?? 0;
      const bo = b.siblingOrder ?? 0;
      if (ao !== bo) return ao - bo;
      if (direction === "left" || direction === "right") return a.y - b.y;
      return a.x - b.x;
    });
}

/**
 * Sibling kế trước/sau (cùng parent + hướng), theo `siblingOrder` — dùng cho
 * điều hướng phím mũi tên lên/xuống. null nếu ở đầu/cuối danh sách hoặc
 * node không có parent (root).
 */
export function siblingNeighbor(
  nodes: Record<string, MindNode>,
  id: string,
  delta: 1 | -1
): string | null {
  const node = nodes[id];
  if (!node?.parentId || !node.direction) return null;
  const sibs = childrenOf(nodes, node.parentId, node.direction);
  const i = sibs.findIndex((s) => s.id === id);
  if (i === -1) return null;
  return sibs[i + delta]?.id ?? null;
}

/** Toàn bộ id trong subtree (gồm root). */
export function collectSubtreeIds(
  nodes: Record<string, MindNode>,
  rootId: string
): string[] {
  const out: string[] = [];
  const stack = [rootId];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur) || !nodes[cur]) continue;
    seen.add(cur);
    out.push(cur);
    for (const n of Object.values(nodes)) {
      if (n.parentId === cur) stack.push(n.id);
    }
  }
  return out;
}

/**
 * Giống `collectSubtreeIds` nhưng DỪNG xuống con của 1 node đang `collapsed`
 * (vẫn gồm chính node đó, chỉ không xuống con/cháu nó). Dùng cho layout (tính
 * chỗ) và canvas (chọn node để render) — subtree đang ẩn thì không cần tính
 * chỗ cho nó, và không được phép chọn/hiện.
 */
export function visibleSubtreeIds(
  nodes: Record<string, MindNode>,
  rootId: string
): string[] {
  const out: string[] = [];
  const stack = [rootId];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur) || !nodes[cur]) continue;
    seen.add(cur);
    out.push(cur);
    if (nodes[cur].collapsed) continue;
    for (const n of Object.values(nodes)) {
      if (n.parentId === cur) stack.push(n.id);
    }
  }
  return out;
}

/** Bounds mép ngoài của cả subtree (world coords). */
export function subtreeBounds(
  nodes: Record<string, MindNode>,
  rootId: string
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of collectSubtreeIds(nodes, rootId)) {
    const n = nodes[id];
    const { w, h } = nodeBoxSize(n);
    minX = Math.min(minX, n.x - w / 2);
    minY = Math.min(minY, n.y - h / 2);
    maxX = Math.max(maxX, n.x + w / 2);
    maxY = Math.max(maxY, n.y + h / 2);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  return { minX, minY, maxX, maxY };
}

function findRootId(nodes: Record<string, MindNode>): string | null {
  for (const n of Object.values(nodes)) {
    if (n.parentId === null) return n.id;
  }
  return null;
}

/**
 * Reflow — xếp lại toàn bộ cây. Rule CHỐT (feedback 2026-09-20, kèm ảnh):
 * **các sibling cùng cha + cùng hướng cách nhau ĐỀU NHAU (cùng 1 khoảng A) và
 * cả cụm canh giữa quanh tâm cha.** Tức 3 con thì: con1 — A — con2 — A — con3,
 * và con giữa nằm ĐÚNG tâm mother. Nếu con1 phình ra (nhiều cháu), con3 cũng
 * được đẩy ra XA TƯƠNG ỨNG — không còn kiểu "con nào to chiếm lát to, con nhỏ
 * dồn cục vào nhau" (bản "lát theo size" trước đó, ae83a77) làm bố cục méo.
 *
 * 2 bước:
 * 1. `computeMetrics` (bottom-up, post-order): mỗi node đo `up`/`down` = tầm
 *    vươn THẬT của cả subtree nó lên trên / xuống dưới, tính từ tâm Y của
 *    chính nó; đồng thời chốt luôn `gapLeft`/`gapRight` = khoảng cách tâm–tâm
 *    ĐỀU cho các con mỗi hướng = MAX qua mọi cặp kề nhau của
 *    (down của con trước + up của con sau + hở mép). Lấy MAX ⇒ mọi cặp đều đủ
 *    chỗ, mà vẫn 1 khoảng duy nhất ⇒ đều.
 * 2. `positionChildren` (top-down): con thứ i đặt tại
 *    `parent.y + (i − (n−1)/2) × A` — đối xứng tuyệt đối quanh cha.
 *
 * Không chồng lấn kể cả cặp KHÔNG kề nhau: với A = max qua các cặp kề,
 * cặp cách nhau 2 bậc có sẵn 2A ≥ (down₁+up₂+hở) + (down₂+up₃+hở)
 * ≥ down₁+up₃+hở (vì up₂+down₂ ≥ 0) — luôn dư chỗ.
 */

type NodeMetrics = {
  /** Tầm vươn lên trên của cả subtree, tính từ tâm Y của node (≥ nửa box riêng) */
  up: number;
  /** Tầm vươn xuống dưới, tương tự */
  down: number;
  /** Khoảng cách tâm–tâm ĐỀU giữa các con hướng trái (0 nếu < 2 con) */
  gapLeft: number;
  gapRight: number;
};

type MetricsMap = Map<string, NodeMetrics>;

const EMPTY_METRICS: NodeMetrics = { up: 0, down: 0, gapLeft: 0, gapRight: 0 };

function metricsOf(metrics: MetricsMap, id: string): NodeMetrics {
  return metrics.get(id) ?? EMPTY_METRICS;
}

/** BRANCH_DIRECTIONS khai báo kiểu Direction (rộng hơn, còn "up"/"down" legacy)
 *  — helper này thu hẹp lại để đọc đúng field gap. */
function gapFor(metrics: MetricsMap, id: string, dir: Direction): number {
  const m = metricsOf(metrics, id);
  return dir === "left" ? m.gapLeft : m.gapRight;
}

/** Vị trí con thứ `i` trong `n` con, lệch so với tâm Y của cha (đối xứng). */
function childOffsetY(i: number, n: number, gap: number): number {
  return (i - (n - 1) / 2) * gap;
}

/** Bước 1: đo tầm vươn up/down của subtree + chốt khoảng cách đều mỗi hướng. */
function computeMetrics(
  nodes: Record<string, MindNode>,
  rootId: string
): MetricsMap {
  const metrics: MetricsMap = new Map();
  // reverse(visibleSubtreeIds) = post-order hợp lệ (con luôn tính trước cha)
  const order = [...visibleSubtreeIds(nodes, rootId)].reverse();
  for (const id of order) {
    const node = nodes[id];
    const own = nodeBoxSize(node).h / 2;
    let up = own;
    let down = own;
    let gapLeft = 0;
    let gapRight = 0;

    if (!node.collapsed) {
      const edgeGap = siblingEdgeGap(node.level + 1);
      for (const dir of BRANCH_DIRECTIONS) {
        const kids = childrenOf(nodes, id, dir);
        if (kids.length === 0) continue;

        // Khoảng cách ĐỀU = max qua mọi cặp kề nhau (đủ chỗ cho cặp "chật" nhất)
        let gap = 0;
        for (let i = 0; i + 1 < kids.length; i++) {
          const a = metricsOf(metrics, kids[i].id);
          const b = metricsOf(metrics, kids[i + 1].id);
          gap = Math.max(gap, a.down + b.up + edgeGap);
        }
        if (dir === "left") gapLeft = gap;
        else gapRight = gap;

        // Tầm vươn của cha = bao trọn các con đã đặt đối xứng quanh nó
        kids.forEach((kid, i) => {
          const d = childOffsetY(i, kids.length, gap);
          const m = metricsOf(metrics, kid.id);
          up = Math.max(up, m.up - d);
          down = Math.max(down, m.down + d);
        });
      }
    }

    metrics.set(id, { up, down, gapLeft, gapRight });
  }
  return metrics;
}

/** Bước 2: đặt con thứ i tại `parent.y + (i − (n−1)/2) × A` (đối xứng quanh cha). */
function positionChildren(
  nodes: Record<string, MindNode>,
  rootId: string,
  metrics: MetricsMap
): Record<string, MindNode> {
  const next: Record<string, MindNode> = { ...nodes };
  // visibleSubtreeIds duyệt pre-order ⇒ cha luôn được đặt xong trước con
  for (const id of visibleSubtreeIds(next, rootId)) {
    const node = next[id];
    if (node.collapsed) continue;
    for (const dir of BRANCH_DIRECTIONS) {
      const kids = childrenOf(next, id, dir);
      if (kids.length === 0) continue;
      const level = node.level + 1;
      const off = branchOffset(dir, node, level);
      const gap = gapFor(metrics, id, dir);
      kids.forEach((kid, i) => {
        next[kid.id] = {
          ...next[kid.id],
          x: node.x + off.x,
          y: node.y + childOffsetY(i, kids.length, gap),
        };
      });
    }
  }
  return next;
}

/**
 * Reflow toàn bộ cây từ root. Rule: box/subtree **không được chồng lấn**, và
 * sibling cùng cha cách nhau ĐỀU. Xem block comment phía trên cho 2 bước.
 */
export function reflowAll(
  nodes: Record<string, MindNode>,
  rootId?: string
): Record<string, MindNode> {
  const rid = rootId ?? findRootId(nodes);
  if (!rid || !nodes[rid]) return nodes;
  const metrics = computeMetrics(nodes, rid);
  return positionChildren(nodes, rid, metrics);
}

/** Chỉ trái/phải (đã bỏ trên/dưới). */
export function directionFromDelta(dx: number, _dy: number): Direction {
  return dx >= 0 ? "right" : "left";
}

/** Hướng được phép tạo nhánh */
export const BRANCH_DIRECTIONS: Direction[] = ["left", "right"];

/**
 * Kéo child tới (worldX, worldY): đổi bên (trái↔phải…) + reorder sibling, reflow.
 */
export function relocateChild(
  nodes: Record<string, MindNode>,
  id: string,
  worldX: number,
  worldY: number
): Record<string, MindNode> {
  const node = nodes[id];
  if (!node?.parentId) return nodes;
  const parent = nodes[node.parentId];
  if (!parent) return nodes;

  const oldDir = node.direction;
  const newDir = directionFromDelta(worldX - parent.x, worldY - parent.y);

  let next: Record<string, MindNode> = {
    ...nodes,
    [id]: { ...node, direction: newDir, x: worldX, y: worldY },
  };

  // Sắp siblingOrder theo trục vuông góc (kéo qua sibling = đổi thứ tự)
  const side = Object.values(next).filter(
    (n) => n.parentId === parent.id && n.direction === newDir
  );
  side.sort((a, b) => {
    if (newDir === "left" || newDir === "right") return a.y - b.y;
    return a.x - b.x;
  });
  side.forEach((sib, i) => {
    next[sib.id] = { ...next[sib.id], siblingOrder: i };
  });

  if (oldDir && oldDir !== newDir) {
    const oldSide = Object.values(next)
      .filter((n) => n.parentId === parent.id && n.direction === oldDir)
      .sort((a, b) => (a.siblingOrder ?? 0) - (b.siblingOrder ?? 0));
    oldSide.forEach((sib, i) => {
      next[sib.id] = { ...next[sib.id], siblingOrder: i };
    });
  }

  // Reflow cả cây: subtree spacing + không chồng chéo giữa các nhánh
  next = reflowAll(next);
  return next;
}

export function placeNewChild(
  nodes: Record<string, MindNode>,
  parentId: string,
  direction: Direction,
  childId: string,
  color: MindNode["color"],
  text = ""
): Record<string, MindNode> {
  const parent = nodes[parentId];
  if (!parent) return nodes;

  const level = parent.level + 1;
  const off = branchOffset(direction, parent, level);
  const existing = childrenOf(nodes, parentId, direction);
  const siblingOrder = existing.length;

  const child: MindNode = {
    id: childId,
    text,
    x: parent.x + off.x,
    y: parent.y + off.y,
    color,
    parentId,
    direction,
    level,
    siblingOrder,
  };

  let next: Record<string, MindNode> = {
    ...nodes,
    [childId]: child,
  };

  // Cả cây: parent/anh em nhánh khác cũng nhường chỗ theo subtree
  next = reflowAll(next);
  return next;
}

/**
 * Line thẳng (không chữ L) — nối TÂM box mother/child (không phải biên).
 * Đoạn nằm trong box tự bị box (z-index cao hơn, nền đặc) che khuất, nên
 * hiệu ứng nhìn vẫn là "cắm vào cạnh", chỉ khác điểm neo TOÁN HỌC là tâm.
 */
export function lineEndpoints(
  parent: MindNode,
  child: MindNode
): { x1: number; y1: number; x2: number; y2: number } {
  // up/down đã tắt UI — map cũ: treat như left/right theo vị trí
  let dir = child.direction ?? "right";
  if (dir === "up" || dir === "down") {
    dir = child.x >= parent.x ? "right" : "left";
  }

  const chW = nodeBoxSize(child).w / 2;

  // Line xuất phát từ TÂM mother (parent.x/y nguyên, không lùi ra mép), kết
  // thúc ở BIÊN child (đúng mép ngoài chW) — không phải ngược lại.
  if (dir === "left") {
    return { x1: parent.x, y1: parent.y, x2: child.x + chW, y2: child.y };
  }
  return { x1: parent.x, y1: parent.y, x2: child.x - chW, y2: child.y };
}

export function boundsOfNodes(nodes: MindNode[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
} {
  if (nodes.length === 0) {
    const h = defaultBoxHeight();
    return { minX: 0, minY: 0, maxX: BOX_W, maxY: h, width: BOX_W, height: h };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const { w, h } = nodeBoxSize(n);
    minX = Math.min(minX, n.x - w / 2);
    minY = Math.min(minY, n.y - h / 2);
    maxX = Math.max(maxX, n.x + w / 2);
    maxY = Math.max(maxY, n.y + h / 2);
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
