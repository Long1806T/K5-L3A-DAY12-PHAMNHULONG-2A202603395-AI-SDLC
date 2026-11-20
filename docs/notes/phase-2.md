# Phase 2 · Ticket-02 "Ba hòn đảo" + Test Contract v1.1

## 1. Thay đổi so với Phase 1 (và test cũ bị ảnh hưởng)

Ticket-02 **thay mọi số tự chọn** bằng số chuẩn. Các quyết định Phase 1 bị thay:

| Phase 1 (giả định cũ) | Phase 2 (chuẩn) | Test cũ xử lý thế nào |
|---|---|---|
| Đảo bán kính 45 m, `fall_enabled: false` (mép chắn) | Đảo bán kính 40 m, rơi khi Y < −10 | "fall_enabled=false…" **thay** bằng test rơi + hồi sinh |
| Mọi đèn có vùng an toàn 4 m; người trong vùng miễn sát thương (G2, G3) | Chỉ **đèn đã sáng** có vùng 6 m, vùng chỉ chặn Bóng Mực | Test safe zone viết lại với đèn sáng; bỏ giả định miễn sát thương |
| Điểm +10 khi **nhặt** đom đóm | +10 mỗi đom đóm **nạp** vào đèn | Test điểm nhặt/nạp sửa kỳ vọng |
| Tỏa sáng tốn 1, bán kính 6 m XZ, choáng 3 s, đẩy ngay 4 m | Tốn 3, bán kính 5 m **3D** từ chân+0,8 m, choáng 120 tick, đẩy 4 m trong 15 tick | Test pulse viết lại |
| Bị chạm: đom đóm rơi biến mất | Rơi ra vành 1,5–2,5 m, tồn tại 480 tick, nhặt lại được | Test chạm thêm kiểm tra đom đóm rơi |
| Bóng Mực luôn đuổi, có 3 con lúc đầu | spawning → wander → chase (12 m) → bỏ (18 m), recoil sau khi chạm; 2 con ở tick 300 | Test tốc độ đuổi đặt Bóng Mực trong 12 m; test sinh viết lại |
| Thắng xét ngay khi nạp (trước thua) | Xét sau mọi cập nhật: hết lửa → thua trước, rồi đủ đèn → thắng, rồi hết giờ | Test thắng/thua sửa thứ tự |

## 2. Tiêu chí nghiệm thu (Phần 3 của ticket + Contract v1.1)

| ID | Tính năng | Tiêu chí kiểm chứng được | Scenario / test |
|---|---|---|---|
| P2-1 | Số chuẩn | `game.contract.json` v1.1 đúng mọi số của Phần 1; có `dash_*`, `night2/3_duration_s` | `contract.test.js` |
| P2-2 | Lướt | Nhấn dash: 12 tick × 14 m/s = 2,8 m theo hướng di chuyển (đứng yên: hướng mặt); trên không giữ độ cao; hồi 90 tick tính từ lúc bắt đầu; sự kiện `dash` | `scenarios/phase2/dash.*` |
| P2-3 | Rơi khỏi đảo | Ra ngoài bán kính 40 m → Y < −10 → `player_hit {by: fall, lost}` đúng 1 lần, mất hết đom đóm, chờ 60 tick, hồi sinh ở (0,0,0) bất tử 90 tick; hết lửa thì thua ngay | `fall.*` |
| P2-4 | Bản đồ 3 Đêm | `--night 1/2/3` đúng số đèn (5/6/7), vị trí đèn, điểm sinh, thời lượng 300/330/360 s | `maps.test.js` |
| P2-5 | Bục nhảy | Đêm 2: chạm bục (20,0,18) → bay ~1,4 s, đáp trên đảo B; Đêm 3: bục (0,3,13) → đáp tầng 2 (Y=6) | `pad-night2.*`, `pad-night3.*` |
| P2-6 | Tầng & vách (Đêm 3) | Không đi thẳng lên tầng cao hơn; đi ra mép thì rơi xuống tầng dưới; lên tầng 1 bằng dốc 30°/150°; tháp chuông chặn | `night3-terrain.test.js` |
| P2-7 | Gió Lạc | Sinh tick 1200 (Đêm 2–3), idle → chase khi mang ≥ 5 và ≤ 15 m; chạm ≤ 1,2 m cướp min(3, mang) → flee 240 tick → biến mất; Tỏa Sáng: chase → flee không cướp, flee có đồ → thả lại `drifter_drop` | `drifter-*.*` |
| P2-8 | Bùa Gió | Nhặt (luật như đom đóm) → `charm_picked {charm_ticks: 600}`, tốc độ 7,2 m/s, lướt không hồi chiêu; xuất hiện lại sau 2700 tick | `charm.*` |
| P2-9 | Gió mạnh (Đêm 3) | Mỗi 1800 sim-tick: gió 300 tick, đẩy 2 m/s theo hướng ngẫu nhiên (theo seed), snapshot `wind.active/dir_deg`; `wind_enabled:false` tắt | `wind.*` |
| P2-10 | Tạm dừng | Input `pause` false→true: `paused {}`, tick tăng nhưng `sim_tick`/thời gian/hồi chiêu/sinh đứng yên, snapshot `state: "paused"`; nhấn lại → `resumed {}` | `pause.*` |
| P2-11 | Bóng Mực chuẩn | Trạng thái đúng tên spawning/wander/chase/recoil/stunned; tốc độ 4 (Đêm 3: 4,5); chạm XZ ≤ 1 m & chênh cao ≤ 1,5 m → recoil 2 m/60 tick; 1 lần mất lửa mỗi tick | `sim.test.js` |
| P2-12 | Vùng an toàn chuẩn | Đèn vừa sáng: Bóng Mực trong 6 m bị đẩy ra mép ≤ 30 tick, không gây sát thương lúc đó; sau đó bị chặn ở mép | `safe-zone.*` |
| P2-13 | Đom đóm chuẩn | 20 lúc đầu tại 20 điểm khác nhau; mỗi 240 tick +1 ở điểm trống nếu < 30; nhặt ≤ 1 m XZ & ≤ 1,5 m cao; sức chứa 10 | `sim.test.js` |
| P2-14 | Snapshot/Scenario/Input v1.1 | Đủ trường mới (`night`, `wind`, `player.vel/grounded/invuln/dash_cd_s/pulse_cd_s/charm_s`, `motes[].kind/ttl_s`, `drifters`, `charms`); scenario mới; `night_start` | `headless-cli.test.js` |
| P2-15 | Hiệu năng headless | Một Đêm đầy đủ ≤ 30 s (đo được ~0,2 s) | `proof.md` |
| P2-16 | Chuỗi 3 Đêm (UI) | Menu → giới thiệu Đêm (lời Ông Đăng) → chơi → kết quả → Đêm sau; thắng Đêm 3 → Bình Minh + tổng điểm; thua → chơi lại Đêm đó | ảnh `screens/` |
| P2-17 | Tạm dừng (UI) | Esc/P: logic dừng; menu Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu | ảnh |
| P2-18 | Cài đặt | Âm lượng + độ nhạy chuột, lưu `localStorage`, còn sau khi tải lại trang | `capture-report.json` |
| P2-19 | Âm thanh | Nhạc nền + 10 hiệu ứng (nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s) tổng hợp bằng WebAudio | `src/web/audio.js`, capture đếm số lần phát |
| P2-20 | HUD đầy đủ | Bố cục đúng vị trí ticket; đồng hồ đỏ + nhấp nháy ≤ 30 s; nhắc "E — Nạp ánh sáng (x/10)"; mũi tên tới đèn chưa sáng gần nhất khi ngoài màn hình | ảnh |
| P2-21 | Bảng màu chuẩn | Màu gốc trong `src/web/palette.js` đúng hex của ticket; ánh sáng môi trường = 0,15 + 0,55 × sáng/tổng | `palette.test.js` |
| P2-22 | ≥ 30 FPS 1280×720 | Đo FPS trung bình bằng `?fps=1` (ghi rõ máy đo) | `proof.md` |

## 3. Giả định cho chỗ ticket chưa nói

| # | Chỗ chưa rõ | Giả định |
|---|---|---|
| H1 | Góc trên bản đồ | Điểm ở góc θ là (r·cos θ, r·sin θ) trên (X, Z). Kiểm chứng bằng chính ticket: dốc 30°/150° và đom đóm tầng 1 (20°–160°) phải nằm ở nửa z > 0 |
| H2 | Điểm xuất phát Đêm 2 / Đêm 3 | Đêm 2: (0,0,0) giữa đảo A. Đêm 3: (0,0,−30) quay mặt +Z (tâm (0,0,0) là tháp chuông) |
| H3 | Tăng tốc ≤ 0,1 s | Vận tốc đổi tức thời (0 s ≤ 0,1 s), điều khiển trên không đầy đủ |
| H4 | Bóng Mực "spawning" | Kéo dài 60 tick, đứng yên, vô hại. Bóng Mực trong scenario không ghi `state` thì là chase nếu trong 12 m, ngược lại wander |
| H5 | Bóng Mực "wander" | Lượn 2 m/s về phía đèn **chưa sáng** gần nhất (lượn quanh nó khi tới gần). Không còn đèn tắt thì lượn quanh điểm sinh. Bóng Mực bay: không rơi, vách tầng không chặn, tháp chuông và vùng an toàn chặn |
| H6 | Độ cao Bóng Mực, Gió Lạc | Bóng Mực tự sinh bay cao 1 m trên mặt đất, Gió Lạc 1,2 m. Bóng trong scenario giữ độ cao đã cho (tương đối so với mặt đất) |
| H7 | Chênh cao khi chạm | So `player.pos.y` với `shade.pos.y` |
| H8 | Trần 30 đom đóm | Tính cả đom đóm rơi. "Điểm trống" là điểm sinh chưa có đom đóm ngẫu nhiên đứng |
| H9 | Điểm sinh hợp lệ (Bóng Mực, Gió Lạc) | Cách Mây ≥ 15 m và không nằm trong vùng an toàn của đèn đã sáng. Gió Lạc dùng chung "điểm sương" với Bóng Mực |
| H10 | Gió Lạc chạm khi idle | Chỉ Gió Lạc đang chase mới cướp |
| H11 | `night_start` | Ghi ngay sau snapshot tick 0, với `tick: 0` |
| H12 | `player.invuln` | Boolean (đang bất tử hay không) |
| H13 | Điểm khi thua | Dòng `end` ghi điểm tích lũy của Đêm. Tổng điểm game (UI) chỉ cộng các Đêm thắng |
| H14 | Hướng gió | Mỗi cơn có hướng riêng theo seed. `dir_deg` dùng cùng quy ước góc H1. Báo trước 120 tick |
| H15 | Đom đóm rơi rơi vào hư không | Thử tối đa 12 điểm trên vành 1,5–2,5 m; không có mặt đất thì đặt tại chân Mây |
