# Đảo Đèn Lồng v1.0.0

Bản phát hành cuối của lab Day 12 AI SDLC: 3 Đêm chơi được từ đầu tới Bình Minh, chế độ headless theo Test Contract v1.3.

## Chạy

1. Cài Node.js ≥ 18. Không cần cài gì thêm.
2. Tải `dao-den-long-v1.0.0.zip`, giải nén.
3. Mở terminal trong thư mục vừa giải nén và chạy `node tools/serve.js --open` (hoặc `npm start`). Trình duyệt sẽ mở game.

## Có gì trong v1.0.0

- Ba Đêm: Đảo Bến, Đảo Cau, Đảo Chuông. Đèn cạn dầu, thắng ở bình minh, điểm, âm thanh tổng hợp.
- Bảng xếp hạng top 10 lưu trên đĩa. Xuất bằng `node tools/serve.js --export-leaderboard out.json`.
- Dễ tiếp cận:
  - đổi phím có phát hiện trùng;
  - phụ đề và chỉ báo hình ảnh;
  - giảm chuyển động;
  - chữ lớn ×1,25;
  - bảng màu dễ phân biệt.
- Benchmark `node tools/bench.js --seed 42 --duration 30 --out bench.json` (cần Chrome hoặc Edge).
- Soak `node tools/soak.js --seed 7 --nights 10 --out soak.json`.
- Test: `npm test` (94 test). Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl`.

Video demo: `demo.mp4` (đính kèm). README, CHANGELOG, CREDITS, retro và bằng chứng từng phase nằm trong repo.
