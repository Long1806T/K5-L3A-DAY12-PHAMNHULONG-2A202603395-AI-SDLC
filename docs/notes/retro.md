# Retro · Đảo Đèn Lồng (4 phase, v1.0.0)

## 1. Tổng hợp Evaluation của 4 phase

| Phase | Kết quả chính | Test | Đo được | AI sai (ai-log) | Chỉnh harness |
|---|---|---|---|---|---|
| 1 · PRD-0, contract v1.0 | Chơi được Đêm 1. Headless đúng contract. Renderer WebGL tự viết | 48 | Đêm 1 headless ≈ 0,3 s; autopilot thắng rồi replay qua CLI cho cùng kết quả | #1–#7 | Tạo `AGENTS.md`, Stop hook, pre-commit, skill, CI |
| 2 · 3 hòn đảo, v1.1 | Đêm 2–3: bục nhảy, Gió Lạc, Bùa Gió, gió mạnh, tầng, tháp chuông. Số chuẩn, âm thanh, tạm dừng, cài đặt | 70 | 3 Đêm tất định (SHA-256 giống nhau); FPS chưa chứng minh được vì không có GPU | #8–#14 | Luật 7 (test dài phải an toàn), luật 8 (chốt phím bấm nhanh) |
| 3 · Đèn cạn dầu, v1.2 | Dầu tính bằng số nguyên 1/60, châm dầu, thắp lại, trạng thái `drain`, thắng ở bình minh. Bảng màu dễ phân biệt | 81 | Chạy test `phase-2` trên code mới: 58/70 đạt, 12 test đỏ đều thuộc luật bị thay | #15–#20 | ADR trước khi code; luật "dầu là số nguyên", "luật dùng chung viết một lần", "không skip test" |
| 4 · Phát hành, v1.3 | Bench, soak, bảng xếp hạng, đổi phím, phụ đề, giảm chuyển động, chữ lớn, gói phát hành, video | 94 | Soak: 0 crash, RSS ×1,10. Bench chạy đúng cảnh chuẩn (FPS thật phải đo trên máy có GPU) | #21–#30 | Luật 9 (chữ ≥ 18 px), luật 10 (so heap với RSS); `release.js` |

Bảng truy vết chi tiết từng yêu cầu nằm ở `docs/proof/phase-N/README.md`, mọi số liệu ở đó đều do script sinh ra.

## 2. Điều hiệu quả và không hiệu quả khi làm với AI

**Hiệu quả**

- **Viết tiêu chí và giả định trước khi code.** Mỗi phase bắt đầu bằng bảng P-x và bảng giả định. AI code theo một danh sách có thể kiểm tra được, không theo trí nhớ. Khi ticket đổi luật (Phase 3), bảng "luật bị thay → test cũ sửa hay xóa" giúp biết trước test nào sẽ đỏ.
- **Core tất định, dùng chung cho web và headless.** Mọi luật đều test được trong vài giây mà không cần trình duyệt. AI sửa luật xong là biết ngay đúng hay sai.
- **Bằng chứng do script sinh ra** (`proof.js`, `capture.mjs`). Không có số liệu nào chép tay, nên không có số liệu "đẹp" mà sai.
- **Bắt AI đo, không tin lời giải thích.** Ví dụ: soak lần đầu vượt ngưỡng bộ nhớ. AI định sửa "chỗ rò bộ nhớ" trong game, nhưng đo heap JS song song với RSS thì thấy game không rò.

**Không hiệu quả**

- AI hay viết kỳ vọng test theo trực giác, rồi sai đúng thứ tự tick hoặc bán kính. Khoảng một phần ba các lỗi trong ai-log thuộc loại này. Cách chữa là bắt AI tính tay theo thứ tự tick, ghi phép tính vào comment, rồi mới chạy.
- Phần nhìn (bố cục, cỡ chữ, góc camera) AI không tự thấy được. Nó chỉ sửa đúng sau khi xem ảnh chụp. Lẽ ra nên chụp ảnh sớm hơn trong mỗi phase.
- Môi trường làm bài không có GPU và không đẩy được tag lên GitHub. Vì vậy FPS thật và tag phải làm trên máy cá nhân (`tools/release.js`). Việc này lẽ ra nên phát hiện và chuẩn bị ngay từ Phase 1.

## 3. Những lần AI sai và cách tôi phát hiện

Có 30 lần, ghi đủ trong `ai-log.md`. Gom theo nhóm:

| Nhóm | Ví dụ | Phát hiện bằng |
|---|---|---|
| Hiểu sai thứ tự tick hoặc số liệu (≈ 10) | Thưởng thắng dùng tick trước bước; test bất tử kỳ vọng sai tick | Test đỏ, so với cách tính tay theo Ticket-02 |
| Test hoặc scenario đặt sai (≈ 8) | Đom đóm nằm ngoài bán kính nhặt; scenario đo tốc độ chết sớm vì đèn cạn dầu | Test đỏ, kết quả chạy thử bất thường |
| Chiến thuật hoặc thiết kế chưa tối ưu (≈ 4) | Bot châm dầu thay vì để đèn tắt rồi thắp lại (đắt gấp đôi) | Tỉ lệ thắng của bot 0/8 |
| Công cụ và đo đạc (≈ 5) | Copy thiếu `index.html` khi chạy test cũ; đọc trạng thái rung camera bị chen ngang; RSS tăng vì JIT | So với một lần chạy độc lập, đo thêm chỉ số thứ hai |
| Giao diện (≈ 3) | Chữ < 18 px, bảng đổi phím tràn màn hình, đồng hồ bench "166666:38" | Xem ảnh capture, thêm test cỡ chữ |

## 4. Harness giúp nhiều nhất

1. **Stop hook + pre-commit chặn khi test đỏ.** Không lần nào commit với test đỏ. `harness-check.txt` của mỗi phase chứng minh hook vẫn hoạt động.
2. **Proof chạy lại test của phase trước trên code mới** (thêm từ Phase 3). Chính bước này chứng minh "test ẩn còn hiệu lực vẫn đạt". Nó cũng từng bắt được lỗi của chính công cụ proof (#20).
3. **`AGENTS.md` với các luật đánh số.** Mỗi lỗi lặp lại thành một luật mới (luật 7–10), nên lần sau AI đọc là tránh được.
4. Skill `verify-game` gom quy trình phát hành bằng chứng thành một danh sách. Skill này ít quan trọng hơn hai mục đầu.

## 5. Token và chi phí

Ước tính tổng: khoảng 12–16 triệu token input (phần lớn đọc từ cache) và khoảng 250–310 nghìn token output; cỡ vài chục USD
nếu tính theo giá API. Chi tiết từng phase và cách tiết kiệm ở `ai-log.md`. Ba cách tiết kiệm nhiều nhất:

- Bằng chứng do script sinh ra.
- Sửa file bằng thay thế nhỏ có kiểm tra, không viết lại cả file.
- Chốt tiêu chí và giả định trước khi code để ít phải làm lại.

## 6. Nếu làm lại thì đổi gì

- **Chuẩn bị môi trường đo thật ngay từ Phase 1**: một máy có GPU cho FPS, và quyền đẩy tag. Đừng để tới phase cuối.
- **Trừu tượng hóa input (keymap) và cỡ chữ ngay từ đầu.** Đổi phím và chữ ≥ 18 px ở Phase 4 phải sửa lại code của Phase 1–2.
- **Chụp ảnh và xem giao diện mỗi khi đổi UI**, không chỉ ở cuối phase.
- **Gắn tag ngay khi xong phase** để đúng mốc giờ của lab, thay vì gom lại cuối cùng.
- Viết bot tốt hơn (leo được tầng ở Đêm 3) để đo được độ khó thật của cả 3 Đêm.
