# Hướng dẫn Matching Partner - Event Copilot

## 1. Kiến trúc Tổng thể Hệ thống

```
[User đăng nhập bằng Google]
           │
           ▼
[Lấy Email & Name từ Profile]
           │
           ▼
[User nhập Devpost URL]
           │
           ▼
[Backend kiểm tra & liên kết với DB crawled]
           │
           ▼
[Liên kết thành công]
           │
           ▼
[User nhập Discord Username]
           │
           ▼
[Lưu thông tin liên hệ]
           │
           ▼
[Hồ sơ hoàn thiện → Sẵn sàng cho Matching Engine]
           │
           ▼
[AI Matchmaking Engine xử lý]
```

---

## 2. Chi tiết Nhiệm vụ Frontend (FE)

Frontend chịu trách nhiệm:
- Điều hướng luồng Onboarding (3 bước chính)
- Hiển thị danh sách Partner phù hợp
- Hỗ trợ kết nối với Discord

### 2.1. Luồng Onboarding (Liên kết Hồ sơ)

#### 2.1.1 Tích hợp Google Authentication

- Đảm bảo sau đăng nhập thành công, lưu trữ:
  - `email`
  - `name`
  - `avatar`
  - Token/Session đầy đủ
- Kiểm tra trạng thái hồ sơ: `is_profile_verified`
  - Nếu `false` → Chuyển hướng sang trang Onboarding
  - Nếu `true` → Chuyển hướng sang trang Matching Partner

#### 2.1.2 Form Nhập Devpost Profile

**Yêu cầu:**
- Tạo Input field để user dán link Devpost profile
- Ví dụ: `https://devpost.com/rithamto`

**Validation (Client-side):**
```regex
^https:\/\/(?:www\.)?devpost\.com\/[a-zA-Z0-9_-]+$
```

**Xử lý sau Submit:**
- Gửi link lên Backend để kiểm tra & liên kết
- Nếu thành công → Lưu `devpost_url` vào profile

#### 2.1.3 Form Nhập Discord Information

**Yêu cầu:**
- Nút mời tham gia Server Discord (mở tab mới)
- Input field để user nhập Discord Username

**Đơn giản (MVP):**
- User tự nhập Discord Username chính xác

**Nâng cấp (tuỳ chọn):**
- Nút "Đăng nhập bằng Discord" (Discord OAuth2)
- Tự động lấy Discord ID/Username chính xác
- Không cần user nhập tay

---

### 2.2. Trang Matching Partner (Giao diện Tìm Đội)

#### 2.2.1 Card Hiển thị Partner

Mỗi card cần hiển thị:
- **Tên** - Tên của partner
- **Role** - Vai trò (ví dụ: Full-stack Developer, Designer, PM)
- **Trạng thái** - Tìm kiếm (ví dụ: "Đang tìm đội", "Tìm Backend Engineer")
- **Kỹ năng** (Skills) - Badge list (React, Python, v.v.)
- **Sở thích** (Interests) - Lĩnh vực quan tâm (AI, Mobile, Web, v.v.)
- **Avatar** - Hình đại diện từ Devpost
- Email

#### 2.2.2 Nút Action "Kết nối ngay"

**Chức năng:**
- Khi user click → Mở Discord hoặc chuyển hướng tới DM
- Sử dụng `discord_username` từ API

**Phương thức:**
- Mở link Discord: `https://discordapp.com/users/[discord_id]` (nếu có ID)
- Hoặc: `discord://users/[discord_id]` (desktop app)
- Fallback: Hiển thị Discord username để user tìm kiếm thручно
- Hoặc có thể liên hệ qua email
---

## 3. Chi tiết Nhiệm vụ Backend (BE)

### 3.1. API Onboarding - Liên kết Hồ sơ

**Endpoint:** `POST /api/profile/link`

**Request Body:**
```json
{
  "devpost_url": "https://devpost.com/rithamto",
  "discord_username": "username#1234"
}
```

**Xử lý:**
1. Kiểm tra `devpost_url` có trùng với participants nào trong DB crawled không
2. Nếu tìm thấy → Ghi nhận thông tin từ crawled data vào hồ sơ user:
   - Name, role, skills, interests từ Devpost
3. Lưu `discord_username` vào hồ sơ
4. Đánh dấu `is_profile_verified = true`

**Response:**
```json
{
  "success": true,
  "profile_id": "user_123",
  "message": "Hồ sơ được cập nhật thành công"
}
```

**Error Handling:**
```json
{
  "success": false,
  "error": "Devpost URL không tìm thấy trong dữ liệu sự kiện"
}
```

---

### 3.2. API Matching Partner

**Endpoint:** `GET /api/partners/matches`

**Query Parameters:**
- `user_id` - ID của user hiện tại
- `limit` - Số lượng partner trả về (default: 10)
- `status` - Filter theo trạng thái: `looking_for_team`, `solo`, `all`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "partner_123",
      "name": "Nguyễn Văn A",
      "avatar": "https://...",
      "role": "Full-stack Developer",
      "status": "looking_for_teammates",
      "skills": ["React", "Node.js", "PostgreSQL"],
      "interests": ["AI", "Web Development"],
      "devpost_url": "https://devpost.com/nguyenvana",
      "discord_username": "nguyenvana#5678"
    },
    ...
  ],
  "total": 45
}
```

**Xử lý:**
- Trả về danh sách user khác đang có trạng thái:
  - `looking_for_teammates` (đang tìm đội)
  - `solo` (chưa có đội)
- Loại bỏ user hiện tại và những user đã kết nối rồi
- Sắp xếp theo độ tương thích (matching score)

---

## 4. Trạng thái Hồ sơ (User Profile Status)

| Trạng thái | Mô tả | Hành động FE |
|-----------|-------|-------------|
| `incomplete` | Chưa hoàn thành onboarding | Hiển thị form Onboarding |
| `verified` | Hoàn thành onboarding | Hiển thị Matching Partner page |
| `matched` | Đã kết nối với teammate | Hiển thị Team info & Chat |

---

## 5. Lưu ý & Best Practices

✅ **DO:**
- Validate input phía client-side (Regex devpost_url)
- Lưu token/session sau login
- Hiển thị loading state khi gọi API
- Cache danh sách partners tạm thời

❌ **DON'T:**
- Gửi API request mà không kiểm tra validation
- Hiển thị thông tin Discord công khai không cần thiết
- Hardcode Discord invite link → dùng config/env