# AI Study Assistant (Electron, Windows)

Ứng dụng hỗ trợ học tập: mở trang học tập trong khung web tích hợp, AI đọc và giải các câu hỏi
(trắc nghiệm, điền số/trả lời ngắn, đúng/sai) kèm giải thích ngắn. Hoàn toàn miễn phí nếu dùng Gemini free tier.

## 1. Lấy API Key miễn phí
Vào https://aistudio.google.com/apikey → đăng nhập Google → "Create API key".
(Có thể dùng Groq/OpenRouter qua chế độ "Tương thích OpenAI" trong Cài đặt.)

## 2. Chạy thử (cần Node.js 18+ từ https://nodejs.org)
    npm install
    npm start

## 3. Tạo file cài đặt .exe trên máy Windows
    npm install
    npm run dist
File nằm ở `dist\AI-Study-Assistant-Setup-1.0.0.exe`.
Nếu gặp lỗi "Cannot create symbolic link": bật Developer Mode (Settings → For developers) hoặc chạy terminal bằng quyền Administrator rồi build lại.

## 4. Không có Windows/Node? Build miễn phí bằng GitHub
1. Tạo repo GitHub, đẩy toàn bộ thư mục này lên nhánh `main`.
2. Tab **Actions** → "Build Windows installer" → chạy (tự chạy khi push).
3. Tải file `.exe` ở mục **Artifacts**.

## Cách dùng
1. ⚙ Cài đặt → dán API Key → Lưu.
2. Dán link → "Mở trang" → tự đăng nhập nếu cần → "Phân tích nội dung".
3. Trang không đọc được? Dán câu hỏi vào ô nhập tay bên phải → "Giải câu hỏi này".
4. ◧ bật/tắt bảng kết quả; thanh trượt "Cỡ chữ" chỉnh chữ trong bảng.

## Bảo mật & giới hạn
- API Key mã hóa bằng Windows DPAPI (Electron safeStorage), lưu trong thư mục dữ liệu người dùng, không nằm trong mã nguồn.
- Ứng dụng chỉ đọc văn bản trang bạn đang mở bằng tài khoản của chính bạn. Không vượt CAPTCHA, không tự đăng nhập, không tác động tới hệ thống giám sát hay chế độ toàn màn hình.
- Hãy dùng cho ôn tập, luyện tập và bài được phép dùng công cụ hỗ trợ; tuân thủ quy chế của trường/khóa học.
- Chưa ký số (code signing) nên Windows SmartScreen có thể cảnh báo: chọn "More info → Run anyway".
- AI có thể sai; hãy kiểm tra lại đáp án quan trọng.
