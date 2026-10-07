# HANDOFF – VietMindmap

**Cập nhật:** 2026-09-20 · **Local:** `D:/Files/Claude/vietmindmap`

### 🔗 LINK CHÍNH

| | |
|---|---|
| **Demo (guest, không cần đăng nhập)** | https://kattyfury.github.io/viet_mindmap/ |
| **GitHub** | https://github.com/KattyFury/viet_mindmap |
| **Branch deploy** | `master` (push → tự deploy GitHub Pages) |

> ĐẦU MỖI PHIÊN đọc CẢ `HANDOFF.md` (file này) + `CLAUDE.md` §5 (rule khóa: text/lines/layout/phím tắt) + `AGENTS.md` (snapshot hành vi nhanh cho agent).
> Lịch sử chi tiết từng commit: `git log` (mô tả commit ghi đủ) — file này chỉ giữ TRẠNG THÁI CUỐI + bài học không hiển nhiên.
> Data: **local-first**, `localStorage` key `vietmindmap:v1:<userKey>` — KHÔNG có server DB, KHÔNG sync đa máy (Supabase để dành, chưa gắn).

---

## 0. Dự án là gì

Mindmap 1 trang, tối ưu cho tiếng Việt (wrap không cắt giữa từ), chạy hoàn toàn phía client. User dùng qua web app đã deploy — **agent sửa xong PHẢI commit + push ngay**, không hỏi lại (xem `CLAUDE.md` §5 mục Git/deploy).

**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind v4 · Zustand (state, undo/redo 10 bước, auto-save localStorage) · canvas HTML+SVG thuần (không lib diagram) · NextAuth Google optional (không có env → fallback `local@vietmindmap`).

---

## 1. Trạng thái tính năng (đã chốt, cập nhật 2026-08-12 cuối ngày)

- **Layout:** root và child **CÙNG kích thước/font hệt nhau** (hợp nhất mục 3f) — khác DUY NHẤT ở màu: root nền solid (đen, hoặc custom — mục 3b) + chữ trắng; child nền trắng + viền cùng màu line + chữ đen. Chỉ nhánh **trái/phải** (không trên/dưới); line thẳng dưới box, dig vào mép; ẩn line khi kéo child.
- **Không chồng lấn:** `reflowAll` bottom-up theo chiều cao cả subtree (`src/lib/layout.ts`); mọi commit text/add/xóa/kéo/hydrate đều reflow lại từ root.
- **Phím tắt:** Tab = tạo child của node đang chọn (không phải sibling từ mother) · Enter = commit · Ctrl+Enter = xuống dòng (không giới hạn số lần) · Delete = xóa child+subtree kể cả đang type (không xóa root) · Ctrl+Z/Y = undo/redo · cuộn = zoom.
- **Export:** PNG full map qua `html-to-image` (`src/lib/export-png.ts`) — render thẳng từ DOM đang hiển thị, không có pipeline canvas riêng.
- **Text trong box (BẢN CUỐI — xem mục 3):** KHÔNG giới hạn số dòng lẫn ký tự — box GROW theo nội dung. Mặc định lúc rỗng/ngắn: **2 dòng, rộng 324px** — root và child dùng chung 1 config (mục 3f). Cả root và child đều **center** (left-align đã bị thử và bác bỏ — đừng đề xuất lại).
- **Màu (mục 3b):** 2 chế độ CHUNG TOÀN APP — rainbow (6 màu/nhánh, mặc định) hoặc custom (1 màu cho mọi box+line+nền root).
- **Sidebar (mục 3c):** tối giản — mỗi map = tên + nút X (confirm xóa) + kéo-thả reorder; nút + cuối list tạo map mới; rộng 225px. Không còn ô tài khoản/thùng rác kéo-thả.

---

## 2. Phiên 2026-08-12 (đầu ngày) — đại tu cơ chế text lần 1: char-count → CSS wrap + max-lines

> ⚠️ **Mục này đã bị THAY THẾ bởi mục 3 (cùng ngày, sau đó)** — `ROOT_MAX_LINES`/`CHILD_MAX_LINES` không còn tồn tại, box giờ KHÔNG có trần, chỉ có size mặc định. Giữ lại mục này vì 2 gotcha kỹ thuật bên dưới (scrollHeight bị sàn, break-spaces vs pre-wrap) **vẫn còn áp dụng nguyên trong kiến trúc mới**. Đọc mục 3 để biết trạng thái CUỐI.

**Yêu cầu ban đầu:** child left-align (trước đó center làm chữ xuống dòng lệch trái-phải nhìn như hình tam giác) + bỏ giới hạn ký tự cứng, thay bằng "box hết chỗ thì hết gõ" + root chỉ 2 dòng (trước đó root/child đều chung 1 số).

**Kiến trúc cũ (đã bỏ hẳn):** đếm ký tự, tự chèn `\n` vào đúng chỗ theo giả định độ rộng ký tự cố định (`CHILD_CHARS_PER_LINE=30`, `ROOT_CHARS_PER_LINE=20`) — đây chính là nguồn gốc hình tam giác (độ rộng ký tự thật không đều nhau).

**Kiến trúc mới:**
- **Wrap = CSS**, không phải JS đếm ký tự. `whiteSpace: break-spaces` (⚠️ KHÔNG phải `pre-wrap` — xem gotcha bên dưới) + `wordBreak: keep-all` + `overflowWrap: break-word` → browser tự xuống dòng theo width thật của box, chỉ hard-cut khi 1 từ dài hơn cả dòng.
- **"Đầy" = đo `scrollHeight` thật** của textarea, so với `maxLines * linePx`. Vượt → revert DOM value ngay trong `onChange` (trước khi paint, không giật hình), không cho gõ thêm. Hàm đo: `measureLinesAtCurrentValue()` trong `MindNodeBox.tsx`.
- `ROOT_MAX_LINES=2`, `CHILD_MAX_LINES=3` (`src/lib/constants.ts`) — tách riêng thay vì 1 `MAX_LINES` chung.
- `src/lib/text.ts` rút gọn còn 3 hàm: `capExplicitBreaks` (an toàn cho data cũ có thể dư newline), `canInsertNewline`, `estimateLineCount` (ước lượng lần render đầu, trước khi đo DOM thật).
- Text align: ban đầu làm **root = center, child = left** (`textAlign` theo `isRoot`) — nhưng user không thích, đổi lại **cả 2 đều center** ngay trong cùng phiên (xem mục 2b).

**2 bug tự bắt được trong lúc làm (đáng nhớ nếu sửa lại):**
1. **`scrollHeight` bị "sàn" bởi height cố định của box.** Đo thẳng `el.scrollHeight` khi box có `height: h` (CSS cố định) luôn ≥ `h` bất kể nội dung ít hay nhiều → tưởng lúc nào cũng đầy. Fix: tạm set `height/maxHeight: auto/none` + `paddingTop: 0` ngay trước khi đo, đo xong restore lại — đúng kỹ thuật autosize-textarea chuẩn.
2. **`white-space: pre-wrap` cho space cuối dòng "hang" ra ngoài** (không tính vào `scrollHeight`) → gõ dấu cách liên tục lúc box đã đầy vẫn lọt qua **vô hạn** (test thực tế ra tới 18 space thừa). Fix: đổi sang `white-space: break-spaces` — spec này KHÔNG cho phép space cuối dòng "hang", nó chiếm chỗ và force wrap như ký tự thường.

**Verify đã làm** (không có browser-automation tool sẵn trong môi trường → tự cài Playwright vào scratchpad, không đụng project): tạo mindmap thật, gõ text dài (EN + VN), Ctrl+Enter 2 lần rồi thử lần 3 (phải bị chặn vì child max 3 dòng = tối đa 2 lần ngắt), paste đoạn dài (phải tự trim theo chiều cao), root gõ tràn (phải dừng ở 2 dòng) — tất cả đúng, 0 lỗi console. `tsc --noEmit` / `next build` / `eslint` đều sạch (lint giữ nguyên baseline lỗi có sẵn từ trước khi đụng vào, không phát sinh thêm).

**Nếu cần sửa tiếp text/wrap sau này:** đọc `CLAUDE.md` §5 mục "Text in boxes" trước (đã cập nhật khớp code), đừng quay lại kiểu đếm ký tự.

### 2b. Revert cùng ngày: child left-align → center lại

User dùng thử xong không thích left-align child ("tao ko thích căn trái child nữa, căn giữa đi") → đổi `textAlign` của child từ `"left"` về `"center"` (2 chỗ trong `MindNodeBox.tsx`: style edit + style hiển thị). Đây là bài học nhỏ: **left-align đã bị thử và bác bỏ** — đừng đề xuất lại trừ khi user chủ động yêu cầu. (Phần còn lại của mục 2 sau đó bị mục 3 thay thế toàn bộ.)

---

## 3. Phiên 2026-08-12 (cuối ngày) — đại tu lần 2: bỏ HẲN max-lines, box GROW tự do + sidebar/màu

User phản hồi max-lines vẫn chưa đúng ý ("khoan, tôi sai rồi... một child box có kích thước mặc định chứa được 2 line chữ NHƯNG có thể mở rộng ra bao nhiêu line tùy thích, các child box không nằm đè nên nhau được"). Sau vài câu hỏi làm rõ: root cũng auto-grow (không riêng child), custom color đổi cả nền root, rainbow giữ 6 màu (không phải 7), setting màu chung toàn app.

### 3a. Kiến trúc box GROW (thay thế hoàn toàn mục 2)

- **Không còn `MAX_LINES` nào** (`ROOT_MAX_LINES`/`CHILD_MAX_LINES` đã xoá). Thay bằng `ROOT_DEFAULT_LINES=1`, `CHILD_DEFAULT_LINES=2` (`constants.ts`, hàm `defaultBoxHeight(isRoot)`) — chỉ là size SÀN lúc rỗng/ngắn.
- **Bề rộng cố định theo loại node** (user cho số cụ thể): Root `ROOT_BOX_W=200`, Child `BOX_W=324`. Chiều CAO mới là thứ grow.
- **`MindNode` có field mới `h?: number`** (world px, không nhân scale) — chiều cao đo được lần commit gần nhất. `undefined` → dùng `defaultBoxHeight()`. `layout.ts`'s `nodeBoxSize()` đọc field này thay vì hằng số cố định — nên MỌI hàm layout (subtreeBounds, reflow, lineEndpoints, boundsOfNodes) tự động support chiều cao động, không cần sửa gì thêm ngoài `nodeBoxSize`.
- **Không đè nhau khi box grow:** `updateText(id, text, h)` giờ LUÔN `reflowAll` sau khi set `h` mới (trước đây `updateText` không đụng layout, vì box size cố định nên không cần). Trong lúc đang GÕ (chưa commit — blur/Enter), box tự lớn lên "live" tại chỗ (không reflow cả cây, chấp nhận tạm đè lên hàng xóm lúc đang gõ — ổn định lại ngay khi commit). Đây là quyết định pragmatic, không phải bug.
- **Đo chiều cao = đo DOM thật**, không suy ra từ ký tự. Editing: `measureAndApplyTextareaBox()` trong `MindNodeBox.tsx` — tạm bỏ `height`/`padding` (set `auto`/`0`) trước khi đọc `scrollHeight`, vì có set sẵn thì `scrollHeight` bị "sàn" ở giá trị đó, không bao giờ báo NHỎ hơn (đúng gotcha đã ghi ở mục 2, vẫn còn nguyên trong kiến trúc mới). Không-edit (hiển thị): đo `span.offsetHeight` để "tự chữa" data cũ/lệch (map cũ chưa có field `h` → tự đo & ghi lại lần đầu render).
- **Canh giữa dọc = chia đều phần dư top/bottom**, KHÔNG cố định `BOX_PAD_Y/2` mỗi bên — vì box có thể đang ở mức SÀN default (rỗng/ngắn) trong khi content thật ngắn hơn, dư ra bao nhiêu phải chia đều 2 bên chứ không dồn hết lên trên.
- ⚠️ **Bug đã gặp + fix (đáng nhớ):** `<textarea>` KHÔNG có `rows` tường minh → browser mặc định cao tối thiểu **2 dòng**, làm `scrollHeight` đo sai ngay cả khi ĐÃ tạm bỏ height/padding (vì đó là intrinsic sizing của thẻ, không phải CSS height) → root (default 1 dòng) bị đo ra ~2 dòng → caret bị đẩy lệch hẳn lên trên thay vì nằm giữa box. Fix: luôn set `rows={1}` trên `<textarea>`, để JS tự quyết định height hoàn toàn.
- **Ctrl+Enter không còn giới hạn số lần** (trước đây cap ở `maxLines-1`). `text.ts` giờ chỉ còn 3 hàm nhỏ an toàn cho data cũ (`capExplicitBreaks`, `canInsertNewline`, `estimateLineCount`) — không xử lý wrap gì cả.

### 3b. Màu — 2 chế độ, chung toàn app

- **Rainbow** (mặc định, không đổi so với trước): 6 màu `BRANCH_COLORS` luân phiên theo nhánh — **đã hỏi lại user có muốn 7 màu (thêm chàm) không, câu trả lời là "nhầm, 6 màu"** — đừng tự ý thêm màu thứ 7 sau này.
- **Custom color:** đúng 1 màu cho MỌI box (viền), MỌI line, VÀ **nền root** (đã hỏi rõ — user xác nhận root cũng đổi nền, không giữ đen cố định ở chế độ này). Chữ trong root tự chọn đen/trắng theo độ sáng (`contrastText()` — công thức relative luminance chuẩn WCAG — trong `colors.ts`), tránh chữ trắng-trên-vàng không đọc được.
- State: `useMindmapStore` (`colorMode`, `customColor`, `setColorMode`, `setCustomColor`) — **KHÔNG nằm trong `MindMapDoc`**, load/save riêng qua `color-settings.ts` (`localStorage` key `vietmindmap:colormode:v1`, không theo `userKey`) vì user xác nhận muốn **chung toàn app**, không theo từng mindmap.
- UI: `ColorModeMenu.tsx` — nút swatch góc trên-phải canvas (cạnh Center/Download), popover 2 lựa chọn + color picker (`<input type="color">`) + 6 swatch preset khi ở custom mode.

### 3c. Sidebar tối giản

User gửi ảnh chê rối: ô tài khoản (email/sign-in), ô "Kéo map vào để xóa", nhãn "Các mindmap" — **"xóa hết các yếu tố này đi"**. Yêu cầu cụ thể: mỗi mindmap chỉ cần nút X để xóa (không cần kéo-thả vào thùng rác), layout `[tên — X]` nhiều hàng + `[+]` cuối cùng. Sidebar giảm còn **3/4 bề rộng cũ** (`SIDEBAR_W`: 300 → 225).

- Đã bỏ hẳn: ô email/sign-in (props `email`/`authEnabled` của `Sidebar` vẫn giữ nguyên chữ ký — cần cho `userKey` ở `AppShell.tsx` — nhưng không còn render UI, đổi tên `_email`/`_authEnabled` theo convention prop-giữ-cho-sau đã có sẵn với `_name`), ô trash-drop kéo-thả, nhãn "Các mindmap".
- Xóa map giờ qua nút X (icon mới `IconClose` trong `icons.tsx`) → mở `ConfirmDialog` có sẵn (không đổi component đó). Kéo-thả để REORDER map trong list vẫn giữ nguyên — chỉ đổi cách XÓA.
- Nút tạo map mới = icon `+` (không chữ), thay cho nút text "Tạo mindmap mới" dài trước đây.

### 3d. Nghiên cứu tham khảo

User trỏ `github.com/topics/mindmap` bảo "tìm tòi rồi làm 1 cái mindmap chất lượng". Đã ghé nhanh (WebFetch, không clone code): Mermaid/Markmap (text→diagram, khác kiến trúc), SimpleMindMap/Mind Elixir/Drawnix (interactive editor, gần giống app này hơn). Xác nhận qua Mind Elixir: pattern "palette màu cho rainbow + CSS-variable/1-màu cho theme custom" là chuẩn phổ biến trong nhóm mindmap tool — khớp hướng đã tự thiết kế ở mục 3b, không có gì phải đổi hướng.

### 3e. Verify đã làm

Không có browser-automation tool sẵn trong môi trường → tự cài Playwright vào scratchpad (`npm i playwright` ngoài project, không đụng `package.json`). Test thực tế: tạo map → gõ dài → box grow, xóa chữ → box co lại; 3 child cạnh nhau độ dài khác nhau → không đè (đo `getBoundingClientRect` từng cặp, verify không giao nhau); Ctrl+Enter 4-5 lần liên tiếp không bị chặn; kéo-thả relocate child vẫn hoạt động với box cao động; đổi rainbow↔custom, chọn màu vàng cho root → chữ tự đổi đen; xóa map qua X → confirm dialog → xóa đúng map; caret canh giữa đúng cho cả root rỗng (1 dòng) và child rỗng (2 dòng mặc định). Tất cả pass, 0 lỗi console. `tsc --noEmit` / `next build` / `eslint` sạch — lint giữ nguyên baseline 5 lỗi có sẵn từ trước (đã verify bằng `git stash` so sánh), warnings +2 (do 2 prop `_email`/`_authEnabled` mới không dùng, theo đúng convention `_name` có sẵn).

### 3f. Chốt ngay sau đó: hợp nhất root/child — chỉ khác MÀU, không khác gì khác

User dùng thử xong yêu cầu bỏ luôn sự khác biệt size giữa root/child vừa làm ở mục 3a: **"Mother không khác gì các Child về kích thước và cấu hình ngoài 1 điểm duy nhất — Mother luôn là nền SOLID chữ TRẮNG còn các child là chỉ có nền trắng còn stroke của box thì cùng màu với line, còn chữ thì đen."**

- Xoá hẳn `ROOT_BOX_W` (200), `ROOT_FONT_SIZE` (17), `ROOT_DEFAULT_LINES` (1) khỏi `constants.ts`. Chỉ còn 1 bộ dùng chung: `BOX_W=324`, `FONT_SIZE=14`, `DEFAULT_LINES=2`. `defaultBoxHeight()` bỏ tham số `isRoot`.
- `layout.ts`'s `nodeBoxSize()` không còn nhánh theo `isRootNode()` cho `w`/`h` nữa — luôn `{w: BOX_W, h: node.h ?? defaultBoxHeight()}`.
- `MindNodeBox.tsx`: bỏ nhánh `isRoot` cho `w`, `fontSize`, `defaultH`, `plusSize` (26→22), size icon trong nút + (16→14) — tất cả về chung 1 giá trị (giá trị cũ của CHILD, vì mô tả của user lấy child làm chuẩn "còn child thì...").
- **CHỈ GIỮ LẠI khác biệt màu** (đã đúng sẵn từ trước, không cần đổi gì): `bg = isRoot ? rootColor : "#FFFFFF"`, `fg = isRoot ? contrastText(rootColor) : "#000000"`, `border = isRoot ? rootColor : (custom ? customColor : node.color)`. `rootColor` = `ROOT_COLOR` (đen) ở rainbow mode, `customColor` ở custom mode — logic màu mục 3b không đổi.
- Các `isRoot` KHÔNG đụng (không phải "size/config" theo nghĩa user hỏi, mà là cấu trúc bắt buộc): `plusDirs` (root không có hướng cha để ẩn bớt nút +), root không kéo-thả được, root không xoá được bằng Delete — những cái này giữ nguyên vì là quy tắc đã LOCKED từ trước, không phải thứ đang được "hợp nhất".
- Verify: đo `boundingBox()` root và child cạnh nhau → width/height bằng nhau tuyệt đối (324×54 lúc rỗng — xem mục 3g, width sau đó giảm còn 259). Đổi custom color → root nền đổi màu đúng, child border+line đổi màu đúng, chữ root/child giữ trắng/đen như mô tả.

### 3g. Chốt cuối: box hẹp lại 4/5, gap ngang hẹp lại 4/5

User: "chiều ngang của 1 mother hoặc child nhỏ lại nha, nhỏ còn 4/5" + "cách ngang giữa mother với child hoặc child với child cũng đang khá nhiều, cho nó đồng bộ và nhỏ lại còn 4/5 đi".

- `BOX_W`: 324 → **259** (`Math.round(324*0.8)`, `constants.ts`).
- `EDGE_GAP` (`layout.ts`): 100 → **80**. Công thức `EDGE_GAP × decay^level` trong `branchOffset()` vốn ĐÃ dùng chung cho mọi cặp parent-child (mother→child hay child→child/cháu) — nên chỉ cần đổi 1 hằng số là tự động đồng bộ toàn cây, không cần sửa gì khác.
- `SIBLING_EDGE_GAP` (gap dọc giữa 2 sibling) — KHÔNG đụng, user chỉ nói "cách ngang" (horizontal).

**Ý tưởng "trăm sông về 1 biển" bị BỎ QUA (user tự chốt khi được hỏi lại):** nút gộp mọi nhánh trái/phải hội tụ về 1 node khác, biến mindmap thành 1 vòng khép kín. Tin nhắn gốc bị ngắt giữa chừng, mô tả geometry không đủ rõ ("gốc bên trái thì gốc 2 bên phải" — chưa hiểu chính xác), và đây là thay đổi kiến trúc RẤT lớn (cây → đồ thị có chu trình) đụng vào gần như mọi rule LOCKED (reflow bottom-up giả định cây không chu trình, no-overlap dựa trên subtree, export bounds, undo snapshot...). Đã hỏi lại — user chọn bỏ qua, chỉ giữ phần width/gap. **Đừng tự ý implement ý tưởng này sau này** trừ khi user chủ động nhắc lại VÀ mô tả rõ geometry mong muốn.

---

## 4. File chính

| Path | Vai trò |
|------|---------|
| `src/lib/layout.ts` | reflow, line endpoints, gap, subtree height — `nodeBoxSize()` đọc `node.h` thật |
| `src/lib/text.ts` | cap newline tường minh (data cũ) — KHÔNG còn xử lý wrap |
| `src/lib/constants.ts` | mọi số đo (box size, default lines, gap, màu…), `defaultBoxHeight()` |
| `src/lib/colors.ts` | `pickBranchColor`, `contrastText` (auto đen/trắng theo độ sáng nền) |
| `src/lib/color-settings.ts` | load/save chế độ màu — `localStorage`, chung toàn app |
| `src/store/mindmap-store.ts` | maps, add/delete/`updateText(id,text,h)`, hydrate+reflowAll, `colorMode`/`customColor` |
| `src/components/MindMapCanvas.tsx` | phím tắt global, pan/zoom, canvas, toolbar (Center/Download/ColorModeMenu) |
| `src/components/MindNodeBox.tsx` | edit box, đo `scrollHeight` để box grow + canh giữa dọc, Tab/Delete khi type, [+] |
| `src/components/ColorModeMenu.tsx` | UI chọn rainbow/custom + color picker |
| `src/components/Sidebar.tsx` | list map tối giản (tên + X + reorder kéo-thả), nút + tạo map |
| `src/lib/export-png.ts` | export PNG qua `html-to-image` |

---

## 5. Phiên 2026-09-11 — lưới bội số 8 + sửa bug lệch bố cục khi 1 nhánh có nhiều con

User gửi ảnh: root có 2 nhánh (A 0 con, B 8 con) — nhánh A bị đẩy lệch hẳn lên góc trên xa root, trong khi B lại nằm sát ngang root. Yêu cầu: (1) mọi font size/box/spacing theo bội số 8, (2) 2 nhánh cùng cấp phải "đều nhau".

**(1) Bội số 8:** `FONT_SIZE` 14→**16**, `LINE_HEIGHT` 1.35→**1.5** (vẫn unitless để tự scale theo zoom — không đổi sang px cố định, tránh vỡ cơ chế đo `scrollHeight`/zoom hiện có), `BOX_W` 259→**256**, `SIDEBAR_W` 225→**224**, `EDGE_GAP_VERTICAL` 140→**144**, `SIBLING_EDGE_GAP` 36→**32**. `defaultBoxHeight()` giờ ra đúng **64** (48 content + 16 pad, cả 2 đều bội số 8). `STROKE_WIDTH`/`BOX_RADIUS` không đụng (không tính là "spacing").

**(2) Root cause của bug lệch:** `reflowSiblings()` cũ tính "before/after" bằng `subtreeBounds()` — gộp CẢ subtree (mọi cháu, chắt...) thành 1 khoảng Y duy nhất, không phân biệt cháu đó nằm ở X nào. Khi B có 8 con, con của B tự xoè đối xứng quanh B (đúng thiết kế), khiến subtree-bounds của B cực lớn theo cả 2 phía. Bước "canh giữa cả cụm A+B theo parent" sau đó dùng đúng khoảng lớn này làm tâm, kéo A (nhỏ xíu, không con) bay xa lên trên — dù A và con-của-B **không hề chồng lấn thật** (con của B ở level 2, dịch xa hơn sang phải, khác hẳn cột X so với A ở level 1).

**Fix — `subtreeLevelProfile()` + `requiredCenterGap()` (`layout.ts`):** thay vì 1 khoảng before/after gộp cả subtree, đo before/after **riêng theo từng absolute level**. Vì `branchOffset()` chỉ phụ thuộc `level + hướng` (không phụ thuộc node cha cụ thể nào), MỌI node cùng level + cùng hướng luôn nằm đúng 1 dải X — nên chỉ level nào TRÙNG NHAU giữa 2 subtree kề nhau mới có nguy cơ chồng lấn thật, cần tính gap; level chỉ có ở 1 bên thì bỏ qua (không có gì để chồng). Canh giữa CỤM sibling-trực-tiếp (stackMin/stackMax) đổi từ "mép subtree" sang "box RIÊNG của sibling đầu/cuối" — nên hàng con trực tiếp luôn đối xứng quanh parent, còn cháu bên trong tự do xoè mà không kéo sibling khác theo.

**Verify:** `tsc --noEmit` / `next build` / `eslint` đều sạch (không phát sinh warning mới). Playwright dựng lại ĐÚNG mindmap trong ảnh user gửi (root + A 0-con + B 8-con) → screenshot xác nhận A/B giờ nằm sát nhau, cân đối quanh root, B tự xoè 8 con bình thường. Test thêm case cả A VÀ B đều có con (2 và 5) → đo `getBoundingClientRect` toàn bộ node, 0 cặp chồng lấn — xác nhận cơ chế chống overlap theo level vẫn đúng khi cả 2 bên cùng có cháu.

### 5b. Bug tiếp theo cùng phiên: 3+ sibling, 1 sibling giữa RỖNG vẫn làm 2 bên chồng lấn

User gửi ảnh khác (thêm nhánh thứ 3 "Bảo mật phải tốt" — không con — chen giữa "Sử dụng phải dễ" và "Phải có những tính năng...") → 2 nhánh 2 bên (có cháu) bị đè lên nhau ở tầng cháu, dù nhánh giữa không hề có gì.

**Root cause:** `requiredCenterGap()` ở mục 5 chỉ so **CẶP LIỀN KỀ** (`profiles[i-1]` với `profiles[i]`) rồi cộng dồn tuần tự. Khi sibling giữa (B) không có nội dung ở 1 level sâu nào đó, nó không "mang" được yêu cầu né nhau giữa A và C ở level đó sang bước tiếp theo — A và C tuy không liền kề nhau về mặt tính toán vẫn thực chất cùng dải X ở level cháu, nhưng thuật toán chưa từng so trực tiếp 2 profile này.

**Fix — contour luỹ kế (`minCenterAgainstContour`, thay `requiredCenterGap`):** khi đặt sibling thứ i, so với **contour = độ vươn XA NHẤT (tuyệt đối) của TẤT CẢ sibling đã đặt trước đó, theo từng level** — không phải chỉ sibling ngay trước. `contour` là 1 `Map<level, absoluteAfter>` cập nhật luỹ kế: đặt xong sibling i thì merge (lấy max) vào contour, sibling rỗng ở giữa đơn giản không đóng góp gì vào contour (không xoá cũng không che mất phần A đã đóng góp trước đó). Đây là kỹ thuật "running contour" chuẩn trong vẽ cây tidy-tree (Reingold-Tilford/Walker), áp dụng rời rạc theo level thay vì contour liên tục.

**Verify:** `tsc`/`build`/`eslint` sạch. Playwright dựng lại đúng case 3 nhánh (A 2 con, B 0 con, C 6 con) → 0 cặp chồng lấn (trước đó có), screenshot xác nhận layout gọn gàng. Chạy lại 2 test cũ ở mục 5a (2 nhánh lệch, 2 nhánh đều có con) → vẫn pass, không hồi quy.

---

## 6. Việc chưa làm / để dành

- Auth Google + sync đa máy qua Supabase — hạ tầng có sẵn (schema JSON tree), **chưa gắn** (xem README mục "Auth Google").
- Chưa có test tự động (không có thư mục test) — verify UI hiện tại là tay/Playwright ad-hoc ngoài repo.

## 7. Phiên 2026-09-18 — mượt hơn (perf) + 3 tính năng mới (collapse, arrow-nav, xuất/nhập text)

User feedback: app "thua xa MindMeister" về cảm giác dùng. Việc chia 2 phần:

**a) Polish hiệu năng/cảm giác (không đổi tính năng):**
- `MindMapCanvas.tsx`: memo hóa `nodes`/`lines` (useMemo) — trước đây recompute cả 2 mảng (kể cả `lineEndpoints` từng cạnh) trên MỖI mousemove khi kéo canvas, dù pan không đổi toạ độ node/line nào → giật khi map nhiều node.
- `MindNodeBox.tsx`: transition 160ms cho `left/top/height` khi vị trí đổi do REFLOW ở chỗ khác trong cây (không còn "nhảy" tức thì). Tắt hẳn khi đang kéo/đang gõ/đang zoom (dùng state so sánh scale render trước — không dùng ref-trong-render vì lint chặn, xem code).

**b) 3 tính năng mới — xem chi tiết ở `CLAUDE.md` §5 (rule khóa, đã cập nhật):**
- **Gấp/mở nhánh (collapse/expand):** field mới `MindNode.collapsed?`, chỉ non-root. Layout-aware qua `visibleSubtreeIds()` trong `layout.ts` (subtree ẩn không chiếm chỗ reflow). Nút tròn nhỏ trên box (luôn hiện khi có con) + phím **Space**.
- **Điều hướng phím mũi tên** giữa các node đã chọn: ↑/↓ = sibling, →/← = sâu hơn/nông hơn theo hướng nhánh (xem bảng phím tắt trong CLAUDE.md).
- **Xuất/nhập text (markdown outline):** `src/lib/markdown.ts`. Nút ".md" cạnh Download (PNG) = xuất; nút upload cạnh "+" ở Sidebar = mở `ImportDialog.tsx` (dán outline → tạo map MỚI, không merge). Lossy ở newline thủ công trong node (gộp thành space) — chấp nhận, ưu tiên đơn giản.

Verify: `tsc --noEmit` + `eslint` (baseline lỗi/warning y hệt trước khi sửa — không phát sinh thêm) + `next build` đều sạch. Đã tự viết script sanity tạm (`scripts/_sanity.ts`, xóa sau khi chạy — không commit) để test `outlineToNodes`/`exportMindmapMarkdown`/`visibleSubtreeIds`: parse đúng số node, đúng level, đúng hướng kế thừa, không trùng toạ độ sau reflow, round-trip export→import giữ nguyên số node, gấp nhánh đúng ẩn/hiện. **Chưa test tay qua browser thật** (môi trường không có sẵn browser automation) — nên tự tay thử qua web trước khi tin tưởng hoàn toàn, đặc biệt: nút gấp có đè lên nút "+" ở box nhỏ/zoom sâu không, phím mũi tên có xung đột gì với thao tác khác không.

**c) Cùng phiên, sau khi user gửi ảnh chê spacing "vẫn ngu" — VIẾT LẠI TOÀN BỘ thuật toán sibling-spacing:**

User chỉ thẳng ảnh chụp: 3 sibling cùng cấp (0 con / 6 con / 1 con) bị lệch nặng, đòi hỏi cụ thể "child 1 nằm ở 1, child 2 (to) nằm ở 0, child 3 nằm ở -1" (đối xứng quanh mother) và yêu cầu **fork thuật toán của 1 lib mindmap thật đã được kiểm chứng** thay vì tự nghĩ tiếp. Đã tìm + đọc `wanglin2/mind-map` (simple-mind-map, MIT, 12k★) — `src/layouts/MindMap.js` (3 hàm `computedBaseValue`/`computedTopValue`/`adjustTopValue`) và `SSShooter/mind-elixir-core` (dùng CSS/DOM flow, không có coordinate algorithm để fork — không dùng được vì kiến trúc canvas hoàn toàn khác VietMindmap).

Đã **thay hẳn** `subtreeLevelProfile`/`minCenterAgainstContour`/`reflowSiblings`/`reflowDescendants` (thuật toán "contour luỹ kế" cũ, chốt 2026-09-11) bằng bản fork 3-bước — chi tiết đầy đủ đã ghi vào `CLAUDE.md` §5 (đọc ở đó, không lặp lại ở đây). Điểm mấu chốt: thuật toán MỚI chỉ đẩy hàng xóm ra xa khi NODE ĐÓ THẬT SỰ quá tải (không dồn tích luỹ một chiều như bản cũ) → sibling nhỏ đứng cạnh sibling to không còn bị kéo lệch vô lý.

Verify kỹ hơn bình thường (đây là thay đổi CORE, đụng đúng chỗ đã có lịch sử bug nhiều nhất — xem mục 5 phía trên): viết script sanity riêng (đã xóa, không commit) với:
- Đúng kịch bản trong ảnh user (0/6/1 con) → xác nhận numeric: child2 (to) nằm ĐÚNG tâm mother, child1/child3 cách đều 2 bên (272.6 mỗi bên, sai số 0).
- Lại đúng kịch bản bug lịch sử mục 5 (3 sibling, giữa rỗng, 2 bên có cháu) → vẫn 0 overlap.
- **50 cây ngẫu nhiên** (30 node/cây, có gấp/mở nhánh ngẫu nhiên xen kẽ) → check AABB pairwise overlap trên `visibleSubtreeIds` (đúng những gì canvas thật render) → **0 overlap cả 50 trial**.
- Root giữ nguyên vị trí sau reflow (không bị dịch).
- Gấp nhánh làm sibling xích gần lại hơn thật (348.8px → 82.0px trong test case cụ thể) và không chồng lấn.

`tsc --noEmit` / `eslint` (baseline y hệt, có sửa 1 warning unused-var phát sinh giữa chừng khi refactor rồi tự dọn) / `next build` đều sạch. **Vẫn chưa test tay qua browser thật** — verify trên chỉ dựa vào toạ độ số + AABB overlap check, KHÔNG phải xem bằng mắt trên web. Việc tiếp theo nên làm: mở web thật, tạo lại đúng cây 3 nhánh (0/6/1 con) như ảnh gốc, xác nhận bằng mắt là đẹp/cân đối như mong đợi.

---

## 8. Phiên 2026-09-20 — sibling spacing: khoảng cách ĐỀU + cân tâm mother

User gửi ảnh cây "mother → 3 con, con1 có 3 cháu": con1 chiếm hơn nửa chiều cao, con2+con3 dồn cục vào chưa tới nửa còn lại. Yêu cầu chốt (ưu tiên cao hơn mọi tối ưu chỗ trống):

> "child 1 — khoảng cách A — child 2 — khoảng cách A — child 3", con giữa LUÔN nằm tâm mother; con1 phình ra thì con3 cũng được đẩy ra xa tương ứng.

**Nguyên nhân bản cũ (`ae83a77`, "lát theo size"):** mỗi con được cấp 1 "lát" cao = size subtree của nó rồi đặt ở tâm lát đó → con có nhiều cháu nhận lát rất cao, các con leaf nhận lát bé xíu nằm sát nhau ⇒ gap giữa các cặp sibling KHÁC NHAU. Đúng về mặt "không chồng lấn + cha nằm giữa mép trên/dưới cụm", nhưng nhìn thì lệch.

**Bản mới (chi tiết đầy đủ + chứng minh không-chồng-lấn đã ghi ở `CLAUDE.md` §5, không lặp lại ở đây):** `computeMetrics` (đo `up`/`down` thật của subtree + chốt 1 khoảng `A` = max qua các cặp kề) → `positionChildren` (con thứ i tại `parent.y + (i − (n−1)/2) × A`). Bỏ hẳn `computeSubtreeSizes`/`subtreeSize`/`areaFor`.

**Đánh đổi (user đã chốt, đừng tự ý tối ưu ngược):** map CAO hơn khi 1 nhánh to, vì mọi gap cùng cấp bị nới bằng cặp chật nhất.

**Verify:** script sanity tạm (đã xóa, không commit) — đúng cây trong ảnh: con1/con2/con3 cách đều 186.24, con giữa lệch tâm mother = 0; cây 2 con (chẵn) vẫn cân 2 bên; kịch bản bug lịch sử (3 con, con giữa rỗng, 2 bên có cháu) gap vẫn đều; 50 cây ngẫu nhiên 30 node có gấp/mở → 0 overlap + gap đều + cụm cân tâm. `tsc --noEmit` sạch, `eslint` baseline y hệt (5 error + 7 warning có sẵn ở `MindMapCanvas.tsx`/`MindNodeBox.tsx`/`Sidebar.tsx`, không phát sinh thêm), `next build` sạch.

**Lần này CÓ test mắt thật** (khác 2 phiên trước): cài Playwright vào scratchpad (không đụng repo), seed `localStorage` key `vietmindmap:v1:local-guest` đúng cây trong ảnh, chạy `next dev`, chụp màn hình → xác nhận con giữa trùng tâm mother, 2 con ngoài cách đều. Cách này tái dùng được cho lần sau khi cần verify UI.
