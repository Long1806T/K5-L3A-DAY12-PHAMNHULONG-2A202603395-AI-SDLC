# Nhật ký dùng AI

## Công cụ và harness

- **AI agent:** Claude (Anthropic), chế độ agent trên claude.ai. Agent đọc đề, lập kế hoạch, viết code, test, tài liệu và chạy lệnh trong môi trường Linux (Node 22, Chrome headless).
- **Vai trò của tôi:** đưa yêu cầu (dán PRD-0 + Test Contract từ lab board), duyệt hướng làm, kiểm tra kết quả qua test, bằng chứng và ảnh.
- **Harness:**
  - `AGENTS.md`: lệnh, kiến trúc, luật bất di bất dịch. `CLAUDE.md` chỉ import file này.
  - `.claude/settings.json`: Stop hook chạy `scripts/verify.sh --hook`. Test đỏ thì trả mã 2, agent không được kết thúc.
  - `.githooks/pre-commit`: chặn commit khi test đỏ.
  - `.claude/skills/verify-game/`: quy trình chạy kiểm chứng và lưu bằng chứng.
  - `.github/workflows/ci.yml`: CI chạy test trên Node 18/20/22.
  - Bằng chứng harness hoạt động: [harness-check.txt](../proof/phase-1/harness-check.txt).

## Phase 1 (PRD-0 + Test Contract v1.0)

### Các bước chính

1. Dán nguyên văn tab Phase 1 của lab board. Yêu cầu agent đọc đề, làm, commit và push.
2. Agent viết **tiêu chí nghiệm thu + giả định trước khi code** (`docs/notes/phase-1.md`), chốt 13 giả định cho chỗ mơ hồ.
3. Thứ tự build: core tất định → CLI headless → test → renderer WebGL → bằng chứng tự sinh → harness → tài liệu.
4. Quyết định lớn: **không dùng thư viện 3D**. Môi trường không tải được three.js; tự viết renderer nhỏ thì giảng viên clone về chạy không cần cài gì và test được trong Chrome headless.
5. Kiểm chứng: 48 test, scenario qua đúng `headless_cmd`, so SHA-256, autopilot thắng trọn đêm rồi replay qua CLI, Playwright chơi bản trình duyệt và đọc state của chính trang.

### Những lần AI sai và cách phát hiện

| # | AI sai gì | Phát hiện bằng | Sửa và chỉnh harness |
|---|---|---|---|
| 1 | Thưởng thời gian khi thắng tính bằng tick **trước** bước (lệch 1 giây: 300 thay vì 299) | Test "lighting the last lantern…" có kỳ vọng tự tính | Truyền tick hiện tại vào `endGame`. Test giữ lại làm hồi quy |
| 2 | Hai test dài giả định người chơi đứng yên sống hết 3 000 tick, nhưng Bóng Mực giết người chơi trước đó (test đọc snapshot không tồn tại) | Một lỗi thấy khi review trước khi chạy, một lỗi do test đỏ (`Cannot read properties of undefined`) | Đặt người chơi trong vùng an toàn. Thêm luật vào `AGENTS.md`: test dài phải đặt người chơi trong safe zone hoặc tắt `random_shades` |
| 3 | Code dựng model 3D còn sót đoạn thử nghiệm (xóa dữ liệu mesh giữa chừng, biến không dùng) | Đọc lại diff | Viết lại hai hàm cho sạch |
| 4 | Trên ảnh chụp, Bóng Mực bị choáng trông gần như lúc bình thường; vòng tỏa sáng biến mất trước khi chụp | Xem ảnh `06-pulse.png` | Đổi màu nhạt + sao xoay trên đầu, hiệu ứng dài 0,8 s. Chụp lại |
| 5 | Báo cáo `proof.md` chèn dòng replay giữa bảng, sinh ra header bảng thừa | Đọc lại file sinh ra | Sửa tool, sinh lại (không sửa tay) |
| 6 | File bằng chứng harness chứa đường dẫn tuyệt đối của máy chạy | Đọc lại file | Script tự đổi sang đường dẫn tương đối để tái lập được trên máy khác |
| 7 | Console trình duyệt báo 404 (favicon) | `capture-report.json` có mục `problems` | Thêm favicon rỗng. Capture coi mọi lỗi console là thất bại |

Không thấy AI bịa yêu cầu ngoài đề. Mọi số trong game đều lấy từ `game.contract.json`; test `contract.test.js` kiểm tra điều này.

### Token và chi phí (ước tính)

Phiên làm việc không có đồng hồ đếm token chính xác, nên đây là **ước tính thô**:

- Output: khoảng 50–60 nghìn token (code + tài liệu khoảng 150 KB).
- Input tích lũy: khoảng 1,5–2,5 triệu token, vì mỗi lượt gửi lại ngữ cảnh; phần lớn được cache.

Cách tiết kiệm đã dùng:

- Không dùng thư viện 3D, nên không phải đọc tài liệu hay debug thư viện.
- Viết tiêu chí trước, nên code đúng ngay phần lớn và chỉ có 2 vòng sửa test.
- Bộ test chạy dưới 2 giây.
- Bằng chứng do tool sinh, không nhờ AI chép tay.
- Không chạy subagent song song. Ảnh chỉ chụp lại 1 lần sau khi sửa hình.
