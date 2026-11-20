# AGENTS.md: Đảo Đèn Lồng

Game 3D (WebGL tự viết, không thư viện) + chế độ headless theo **Test Contract** (`game.contract.json`, hiện v1.2). 3 Đêm: Đảo Bến, Đảo Cau, Đảo Chuông. Thắng ở **bình minh** khi ≥ 60 % đèn đang sáng (ADR 0001).

## Lệnh
- Test (bắt buộc xanh trước khi kết thúc/commit): `npm test`
- Headless: `node src/headless.js --seed 1 --night 1|2|3 --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`
- Chơi: `npm start` (server tĩnh + mở trình duyệt). Tham số dev: `?night=2&autostart=1&seed=3&scenario=…&yaw=90&fps=1&debug=1`
- Bằng chứng: `npm run proof -- --phase N` (sinh `docs/proof/phase-N/`); ảnh: `node tools/capture.mjs --out docs/proof/phase-N/screens`
- Kiểm tra nhanh toàn bộ: `sh scripts/verify.sh` · chứng minh hook: `sh scripts/harness-check.sh N`

## Kiến trúc
- `src/core/`: logic **thuần, tất định**. Chỉ `createWorld()` + `step()` + `snapshot()`. Trình duyệt và headless dùng chung.
  - `sim.js` theo **đúng thứ tự tick của Ticket-02** (comment đầu file) + Ticket-03 (bước 2 trừ dầu, rồi tắt đèn fuel ≤ 0): đổi luật thì giữ thứ tự này.
  - Dầu đèn lưu bằng **số nguyên đơn vị 1/60** (`FUEL_UNITS`); chỉ làm tròn khi ghi snapshot (`fuelValue`). Đừng cộng trừ dầu bằng số thực.
  - Luật dùng chung cho core và UI (sức chứa, ngưỡng thắng, đèn yếu) chỉ viết **một lần** trong `sim.js` (`capacity`, `winThreshold`, `isWeak`, `lightCost`). UI import, không tự tính lại.
  - `level.js`: bản đồ chuẩn + `groundHeight()`; góc θ trên bản đồ là (r·cosθ, r·sinθ).
  - `rules.js`: số chuẩn **không** nằm trong tuning của contract. Số có trong contract thì đọc từ contract.
- `src/headless.js`: CLI. File input sai → exit 2; lỗi khác → exit 1. Ghi `night_start` (tick 0) ngay sau snapshot đầu.
- `src/web/`: chỉ đọc state để vẽ. `palette.js` giữ hex chuẩn; tạm dừng đi qua input `pause` của core.
- `scenarios/phaseN/`: mỗi tính năng có ≥ 1 scenario chạy qua CLI (`tests/features.test.js`).

## Luật bất di bất dịch
1. Không dùng `Math.random`, `Date`, `performance` trong `src/core/`; ngẫu nhiên đi qua `w.rng.*` (mỗi loại một luồng seed riêng).
2. Mọi số tuning đọc từ `game.contract.json`. Không hard-code số đã khai trong contract.
3. Định dạng JSONL, tên trạng thái Bóng Mực (spawning/wander/chase/recoil/stunned/drain), tên sự kiện: đúng contract. Đổi contract → sửa test cũ **kèm lý do** (comment `P2:`/`P3:` trong test + bảng trong `docs/notes/phase-N.md`). Luật bị thay thì xóa test kèm comment lý do, **không** dùng `skip`.
4. Phần sáng tạo không được đổi output headless (chỉ ở `src/web/`).
5. Bằng chứng không sửa tay: chạy lại tool để sinh.
6. Giả định mới cho chỗ mơ hồ → ghi vào bảng giả định của phase.
7. Test chạy dài (> 600 tick) phải tắt `random_shades` hoặc cho Mây nhiều lửa (`flames: 999`), nếu không Bóng Mực kết thúc đêm sớm (lỗi đã gặp ở Phase 1–3; từ Phase 3 đèn cạn dầu nên vùng an toàn không còn che được cả Đêm).
8. Test trình duyệt: phím bấm nhanh phải được "chốt" tới tick sau (`Controls.tapped`), đừng đọc phím thô (lỗi đã gặp ở Phase 2).

## Quy ước
- Commit nhỏ, thông điệp kiểu `feat(core): …`, `test: …`, `docs: …`. Hook `.githooks/pre-commit` chặn commit khi test đỏ (`git config core.hooksPath .githooks`).
- Tài liệu tiếng Việt, code/comment tiếng Anh.
