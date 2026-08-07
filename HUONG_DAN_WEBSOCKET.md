# Hướng Dẫn Dựng Server WebSocket Thật (Chat Toàn Cục / Phòng Đấu / Cược)

Code server đã viết sẵn ở thư mục `ws-server/`. Đây là một server Node.js
độc lập, **tách riêng khỏi app Next.js chính** — vì Vercel (nơi thường host
Next.js) không giữ kết nối WebSocket sống lâu dài được. Server này cần một
nơi host riêng, chạy 24/7. Mình dùng **Render.com** (có gói miễn phí, không
cần thẻ tín dụng).

Mất khoảng 10-15 phút.

---

## Bước 1 — Đưa code lên GitHub

Server cần lấy code từ một Git repo để deploy. Nếu bạn chưa có repo:

1. Tạo tài khoản/repo mới tại https://github.com (bấm **New repository**).
2. Trên máy, trong thư mục project (thư mục `edit`), chạy:
   ```bash
   git init
   git add .
   git commit -m "Kaiji e-card + websocket server"
   git branch -M main
   git remote add origin https://github.com/<ten-ban>/<ten-repo>.git
   git push -u origin main
   ```
   (Thay `<ten-ban>` và `<ten-repo>` bằng thông tin thật của bạn.)

> Toàn bộ repo (cả app Next.js lẫn `ws-server/`) nằm chung 1 repo cũng
> không sao — ở Bước 3 mình sẽ chỉ định đúng thư mục con `ws-server`.

## Bước 2 — Tạo tài khoản Render

1. Vào https://render.com → **Get Started** → đăng nhập bằng GitHub.
2. Cho phép Render truy cập repo bạn vừa tạo.

## Bước 3 — Tạo Web Service cho `ws-server`

1. Trong Render Dashboard → **New +** → **Web Service**.
2. Chọn repo vừa push ở Bước 1.
3. Điền cấu hình:
   - **Name**: `kaiji-global-hub` (hoặc tên bất kỳ — tên này sẽ nằm trong URL)
   - **Root Directory**: `ws-server`  ⚠️ **quan trọng**, đây là thư mục con chứa server, không phải gốc repo
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free**
4. Bấm **Create Web Service**.
5. Đợi Render build & deploy (theo dõi log, khoảng 1-2 phút). Khi thấy dòng
   log `🚀 Kaiji global hub listening on port ...` là server đã chạy.
6. Copy URL Render cấp cho bạn ở đầu trang, dạng:
   ```
   https://kaiji-global-hub.onrender.com
   ```

## Bước 4 — Điền URL vào app game

WebSocket dùng giao thức `wss://` (bản mã hoá của `ws://`), **không phải**
`https://`. Đổi `https://` thành `wss://`:

```
wss://kaiji-global-hub.onrender.com
```

Mở file `.env.local` trong thư mục `edit`, điền vào dòng cuối:

```bash
NEXT_PUBLIC_WEBSOCKET_URL=wss://kaiji-global-hub.onrender.com
```

Lưu file, restart `pnpm dev` (Ctrl+C rồi chạy lại `pnpm dev`) để app đọc
biến môi trường mới.

## Bước 5 — Khi deploy app game thật (Vercel)

Vào project trên Vercel → **Settings → Environment Variables** → thêm:

```
NEXT_PUBLIC_WEBSOCKET_URL = wss://kaiji-global-hub.onrender.com
```

rồi **Redeploy**.

---

## Kiểm tra hoạt động

1. Mở game ở 2 tab trình duyệt khác nhau (1 tab thường, 1 tab ẩn danh).
2. Gõ tin nhắn ở khung chat toàn cục ở Tab 1.
3. **Kỳ vọng:** tin nhắn xuất hiện ngay ở Tab 2.
4. Mở DevTools Console (F12) — không còn thấy lỗi `WebSocket connection
   failed` nữa, thay vào đó là `[WebSocket] Connected to global hub`.

## Lưu ý về gói miễn phí của Render

- Gói Free của Render sẽ "ngủ" sau ~15 phút không có traffic, và mất khoảng
  30-50 giây để "thức dậy" ở request đầu tiên sau đó. Điều này bình thường
  — chỉ ảnh hưởng độ trễ lần kết nối đầu, không ảnh hưởng gì khi đang hoạt động.
- Nếu về sau lượng người chơi đông và cần chạy 24/7 không ngủ, nâng cấp lên
  gói trả phí thấp nhất của Render (~7 USD/tháng) là đủ cho quy mô này.

## Xử lý sự cố

| Hiện tượng | Nguyên nhân | Cách sửa |
|---|---|---|
| Vẫn thấy `WebSocket connection failed` | Sai `wss://` thành `https://`, hoặc chưa restart `pnpm dev` | Kiểm tra lại Bước 4 |
| Render build lỗi "Cannot find module" | Root Directory không phải `ws-server` | Sửa lại Root Directory ở Bước 3 |
| Chat không đồng bộ giữa 2 tab | Cả 2 tab chưa cùng trỏ về 1 URL server, hoặc server đang "ngủ" (đợi thêm 30s) | Kiểm tra `.env.local` giống nhau, thử lại sau ít giây |
