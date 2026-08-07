# Kaiji E-Card Game - Upgrade Part 2: Economic & Security Overhaul

## 1. INTERACTIVE ROUND-BY-ROUND WAGER ENGINE
- **Slider Điều Khiển:** Tích hợp slider "MỨC CƯỢC VÒNG NÀY / ROUND WAGER" ngay trên bàn đấu.
- **Tùy Chỉnh Linh Hoạt:** Người chơi có thể thay đổi mức cược trước khi chọn bài mỗi vòng.
- **Ràng Buộc Động:** Mức cược tối đa bị giới hạn bởi tổng tài sản hoặc hạn mức tín dụng của người chơi.
- **Mock Hyodo Bluffing:** Chairman Hyodo trong chế độ AI có khả năng tố thêm tiền (tăng 300%) khi đang chiếm ưu thế, đi kèm với các câu thoại đe dọa.

## 2. THE CATASTROPHIC "ULTIMATE LIFE-WAGER" MECHANIC
- **Nút Cược Mạng:** Nút "CƯỢC MẠNG / ULTIMATE LIFE-WAGER" gỉ sét, nguy hiểm đặt ngay dưới dock bài.
- **Cơ Chế Khóa:** Kích hoạt sẽ đẩy mức cược lên 100% tài sản và khóa slider.
- **Ma Trận Thắng/Thua Kinh Hoàng:**
  - **Thắng:** Xóa bỏ hoàn toàn nợ nần (`currentDebt` về 0).
  - **Thua:** HP về 0 ngay lập tức, mũi khoan tiến thẳng tới Step 5, thực hiện finisher "Chopped in Half" ngay lập tức.

## 3. CANVAS HARDWARE DEVICE FINGERPRINTING & ROOM LIFE-CYCLE
- **Fingerprinting Kỹ Thuật Cao:** Sử dụng `generateHardwareFingerprint()` kiểm tra GPU (WebGL), CPU cores, và Canvas pixel-buffer để tạo hash duy nhất.
- **Chống Gian Lận:** Phát hiện 2 Client chạy trên cùng một phần cứng (kể cả tab ẩn danh). Nếu trùng hash, hệ thống sẽ đóng băng bảng điểm và cảnh báo "PHÁT HIỆN GIAN LẬN".
- **Lobby Dashboard:** 
  - Hiển thị bảng "BÀN CƯỢC ĐANG TRỐNG / AVAILABLE MATCHES" công khai.
  - Nút "VÀO NGAY / JOIN" trực tiếp.
  - Cơ chế dọn dẹp phòng (Room Scrubbing) ngay khi host thoát hoặc đầu hàng.

## 4. COGNITIVE SELF-BALANCING MATRIX
- **Comeback Path:** Tự động tăng hệ số thưởng (1.5x) khi HP người chơi dưới 30 hoặc nợ trên 500M VND.
- **Ruthless AI Scaling:** Tăng 45% tần suất tố tiền và độ hung hãn của Hyodo khi người chơi thắng liên tiếp (>2 ván).

## 5. CÔNG NGHỆ & HIỆU SUẤT
- **60fps Compliance:** Đảm bảo hiệu suất ổn định ngay cả khi xử lý các thuật toán phức tạp.
- **Web Audio API:** Duy trì âm thanh tổng hợp chất lượng cao.
- **C-shaped Silhouette:** Giữ vững phong cách thiết kế nhân vật gù lưng đặc trưng.

---
**Files Modified:**
- `components/ecard-game.tsx`: Core logic, Wager Engine, Life-Wager, Fingerprinting, Balancing.
- `components/ecard/lobby.tsx`: Dashboard bàn cược, Room Life-cycle.
- `components/ecard/types.ts`: Cấu trúc dữ liệu mới cho Part 2.
