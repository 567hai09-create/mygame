# Hướng Dẫn Thiết Lập Tài Khoản Gmail Thật (Firebase Auth) Cho E-CARD

Code đã được viết sẵn và tích hợp đầy đủ (đăng nhập Google, đồng bộ tiến
trình lên đám mây). Bạn chỉ cần tạo project Firebase và điền key — **không
cần sửa code**. Mất khoảng 10 phút.

Nếu bạn không điền key, app vẫn chạy bình thường như trước (lưu local trên
máy), chỉ là không có nút đăng nhập.

---

## Bước 1 — Tạo project Firebase

1. Vào https://console.firebase.google.com
2. Đăng nhập bằng tài khoản Gmail của bạn.
3. Bấm **"Add project" / "Thêm dự án"**.
4. Đặt tên project (ví dụ: `ecard-kaiji`) → **Continue**.
5. Tắt Google Analytics nếu không cần (không bắt buộc) → **Create project**.
6. Đợi vài giây, bấm **Continue** khi tạo xong.

## Bước 2 — Đăng ký một "Web App" trong project

1. Ở trang tổng quan project, bấm biểu tượng **`</>`** (Web) để thêm app web.
2. Đặt nickname (ví dụ: `ecard-web`) → **KHÔNG** cần tick Firebase Hosting.
3. Bấm **Register app**.
4. Firebase sẽ hiện ra một đoạn code có object `firebaseConfig` trông như
   thế này:

   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "ecard-kaiji.firebaseapp.com",
     projectId: "ecard-kaiji",
     storageBucket: "ecard-kaiji.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef1234567890",
   }
   ```

   **Giữ tab này mở** — bạn sẽ copy các giá trị này sang bước 5.

## Bước 3 — Bật đăng nhập bằng Google

1. Ở menu bên trái: **Build → Authentication**.
2. Bấm **Get started**.
3. Tab **Sign-in method** → bấm **Google** trong danh sách nhà cung cấp.
4. Bật công tắc **Enable**.
5. Chọn một **support email** (email hỗ trợ, thường là chính email bạn) →
   **Save**.

## Bước 4 — Tạo database Firestore (lưu tiến trình lên mây)

1. Menu bên trái: **Build → Firestore Database**.
2. Bấm **Create database**.
3. Chọn **Start in production mode** → **Next**.
4. Chọn vị trí server gần bạn nhất (ví dụ `asia-southeast1`) → **Enable**.
5. Vào tab **Rules**, xoá hết nội dung mặc định và dán đoạn sau, rồi bấm
   **Publish**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /profiles/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

   Đoạn rule này đảm bảo mỗi người chỉ đọc/ghi được đúng hồ sơ của chính
   mình — không ai đọc trộm hay sửa điểm của người khác được.

## Bước 5 — Điền key vào project code

1. Trong thư mục code, copy file `.env.local.example` thành `.env.local`:

   ```bash
   cp .env.local.example .env.local
   ```

2. Mở `.env.local`, dán giá trị từ object `firebaseConfig` ở Bước 2 vào
   đúng chỗ:

   ```bash
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ecard-kaiji.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=ecard-kaiji
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ecard-kaiji.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
   ```

3. Cài package `firebase` (đã có sẵn trong `package.json`):

   ```bash
   pnpm install
   ```

4. Chạy lại app:

   ```bash
   pnpm dev
   ```

5. Vào lobby — bạn sẽ thấy nút **"☁ Đăng Nhập Google Để Lưu Tiến Trình"**
   ngay dưới logo E·CARD. Đăng nhập thử bằng Gmail của bạn.

## Bước 6 — Khi triển khai lên Vercel / hosting thật

Thêm đúng 6 biến `NEXT_PUBLIC_FIREBASE_*` ở trên vào phần **Environment
Variables** của dự án trên Vercel (Settings → Environment Variables), rồi
vào lại Firebase Console:

1. **Authentication → Settings → Authorized domains** → bấm **Add domain**
   → nhập domain thật (ví dụ `ecard.pw` hoặc domain Vercel của bạn).
   Thiếu bước này thì đăng nhập Google sẽ báo lỗi `auth/unauthorized-domain`
   trên domain thật dù chạy `localhost` vẫn ổn.

---

## Cách hoạt động (tóm tắt kỹ thuật)

- Không có key → `isFirebaseConfigured = false` → nút đăng nhập tự ẩn,
  toàn bộ game chạy như cũ bằng `localStorage`. Không lỗi, không crash.
- Có key → đăng nhập Google xong, hồ sơ (`PlayerProfile`: tên, danh hiệu,
  tổng tiền thắng, số trận thắng, số lần bị xử tử) được đồng bộ hai
  chiều với Firestore ở collection `profiles/{uid}`.
- Khi đăng nhập trên máy thứ hai, hệ thống **lấy giá trị lớn hơn** giữa
  local và cloud cho các chỉ số (tiền, số trận thắng...) — không bao giờ
  bị mất tiến trình đã có.
- Mỗi thay đổi hồ sơ (thắng ván, đổi tên...) được đẩy lên Firestore sau
  1.5 giây (debounce) để tránh ghi liên tục.

## Xử lý sự cố thường gặp

| Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|
| `auth/unauthorized-domain` | Domain chưa được thêm vào Authorized domains | Bước 6 |
| `auth/api-key-not-valid` | Sai `NEXT_PUBLIC_FIREBASE_API_KEY` hoặc chưa restart `pnpm dev` sau khi sửa `.env.local` | Kiểm tra lại key, restart dev server |
| `Missing or insufficient permissions` | Firestore Rules chưa publish đúng | Bước 4.5 |
| Nút đăng nhập không hiện | Thiếu biến môi trường | Kiểm tra `.env.local` có đủ 6 biến, đã restart `pnpm dev` |
