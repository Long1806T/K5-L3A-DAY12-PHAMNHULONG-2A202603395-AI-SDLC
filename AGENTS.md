# AGENTS.md: Đảo Đèn Lồng

Game 3D (WebGL tự viết, không thư viện) + chế độ headless theo **Test Contract** (`game.contract.json`).

## Lệnh
- Test (bắt buộc xanh trước khi kết thúc/commit): `npm test`
- Headless: `node src/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`
- Chơi: `npm start` (server tĩnh + mở trình duyệt)
- Bằng chứng: `npm run proof -- --phase N` (sinh `docs/proof/phase-N/proof.md`); ảnh: `node tools/capture.mjs --out docs/proof/phase-N/screens`
- Kiểm tra nhanh toàn bộ: `sh scripts/verify.sh`

## Kiến trúc
- `src/core/`: logic **thuần, tất định**. Chỉ `createWorld()` + `step()` + `snapshot()`. Trình duyệt và headless dùng chung.
- `src/headless.js`: CLI theo contract. File input sai → exit 2; lỗi khác → exit 1.
- `src/web/`: chỉ đọc state để vẽ, không đổi luật chơi.
- `scenarios/phaseN/`: scenario/inputs mẫu (dùng cho test + proof).

## Luật bất di bất dịch
1. Không dùng `Math.random`, `Date`, `performance` trong `src/core/`; ngẫu nhiên đi qua `createRng(seed|...)`.
2. Mọi số tuning đọc từ `game.contract.json`. Không hard-code số đã khai trong contract.
3. Định dạng JSONL, thứ tự tick, tên sự kiện: đúng contract của phase hiện tại. Đổi contract → sửa test cũ **kèm lý do** trong `docs/notes/phase-N.md`.
4. Phần sáng tạo không được đổi output headless (tắt/không ảnh hưởng khi chạy headless).
5. Bằng chứng không sửa tay: chạy lại tool để sinh.
6. Giả định mới cho chỗ mơ hồ → ghi vào bảng giả định của phase.
7. Test chạy dài (> 600 tick) phải đặt người chơi trong vùng an toàn của một đèn hoặc tắt `random_shades`, nếu không Bóng Mực kết thúc đêm sớm (lỗi đã gặp ở Phase 1).

## Quy ước
- Commit nhỏ, thông điệp kiểu `feat(core): …`, `test: …`, `docs: …`. Hook `.githooks/pre-commit` chặn commit khi test đỏ (`git config core.hooksPath .githooks`).
- Tài liệu tiếng Việt, code/comment tiếng Anh.
