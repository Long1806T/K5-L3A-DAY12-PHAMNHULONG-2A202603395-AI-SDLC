# CREDITS

| Thành phần | Nguồn | Giấy phép |
|---|---|---|
| Mã nguồn game, renderer WebGL, CLI headless, test, công cụ | Viết cho dự án này, có hỗ trợ của AI (Claude, Anthropic). Xem [nhật ký dùng AI](docs/notes/ai-log.md) | MIT ([LICENSE](LICENSE)) |
| Mô hình 3D (Mây, nón lá, đèn lồng, Bóng Mực, Gió Lạc, Bùa Gió, 3 đảo, cầu tre, tầng, tháp chuông, cây, bến) | Sinh bằng code (`src/web/meshes.js`), hình khối low-poly, không dùng file mô hình ngoài. Code do AI viết theo chỉ dẫn | MIT |
| Hình ảnh HUD (biểu tượng ngọn lửa, mũi tên chỉ hướng) | SVG và CSS viết tay trong `src/web/hud.js`, `index.html`. Biểu tượng ⚠ 🌬 ⏳ 🏮 là ký tự emoji của phông hệ thống | MIT |
| Phông chữ | Phông hệ thống của máy người chơi (`system-ui`) | n/a |
| Âm thanh (nhạc nền ngũ cung + 17 hiệu ứng) | Tổng hợp bằng WebAudio lúc chạy (`src/web/audio.js`): dao động sóng sin/tam giác/vuông + nhiễu lọc. Không có file âm thanh. Code do AI viết theo chỉ dẫn | MIT |
| Nhân vật, bối cảnh, tên gọi, bảng màu chuẩn | Đề bài lab Day 12 AI SDLC (PRD-0, Ticket-02). Lời thoại Ông Đăng do AI viết theo bối cảnh | thuộc khóa học |
| Video demo (`docs/demo/demo.mp4`) | Quay từ chính game: ảnh chụp từng khung qua Playwright, ghép bằng ffmpeg (`tools/demo.mjs`). Phần chơi do autopilot `tools/bot.js` điều khiển. Phần bằng chứng là output thật của các lệnh test, headless, bench, soak | MIT |
| Công cụ phát triển | Node.js; Google Chrome / Chrome for Testing + Playwright để chụp ảnh bằng chứng, quay video và chạy benchmark khi không có màn hình (Xvfb); ffmpeg để ghép video. Chỉ dùng khi phát triển, không cần để chơi | theo giấy phép của từng công cụ |
| Công cụ AI tạo nội dung | Claude (Anthropic): viết code, test, tài liệu, lời thoại và chữ trong game theo chỉ dẫn; mọi bước được ghi trong [nhật ký dùng AI](docs/notes/ai-log.md). Không dùng AI tạo ảnh, nhạc hay giọng nói | theo điều khoản của dịch vụ |

Không có asset bên ngoài nào được tải về hay nhúng vào repo.
