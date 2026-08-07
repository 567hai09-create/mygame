# Kaiji E-Card Game - Redesign Update v2.0

## 1. COMPONENT GRAPHICS RE-DESIGN (XÓA BỎ LỖI BÓNG HÌNH THÁP PHÈN)

### Silhouette Component (`components/ecard/silhouette.tsx`)
- **Xóa bỏ hoàn toàn:** Cấu trúc tháp tròn cũ (SVG path-based), các đường cong phức tạp
- **Thay thế bằng:** Pure HTML div lateral profile layout
- **Cấu trúc mới:**
  - Torso div: `w-24 h-40 bg-[#0a0a0d] rounded-t-[80px_120px]`
  - Head div: `w-14 h-14 rounded-full` nested near forward slope
  - Lower forearm block: `w-full h-8 bg-[#07070a]`

### Kẻ Vô Danh (Left Avatar / Slave)
- **Transform:** `skew-x-12 rotate-6 -translate-x-2` (hunch forward aggressively)
- **Glow Filter:** `drop-shadow(0 0 15px #9e2a2b)` (blood-red)
- **Name Color:** `text-[#9e2a2b]` (crimson shade)

### Hyodo (Right Avatar / Emperor)
- **Transform:** `-skew-x-12 -rotate-6 translate-x-2` (hunch forward to left)
- **Glow Filter:** `drop-shadow(0 0 15px #b3914a)` (royal gold)
- **Name Color:** `text-[#b3914a]` (imperial gold shade)

### Execution Animation
- **Split effect:** Crimson line with red glow during execution
- **Drill mechanism:** Preserved for game logic, repositioned for new layout

---

## 2. LOBBY RE-ALIGNMENT & INDEPENDENT GLOBAL WORLD CHAT

### Lobby Layout (`components/ecard/lobby.tsx`)
- **Grid System:** `grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full`
- **Balanced 2-column layout** for optimal visual hierarchy

### Left Column (Game Modes Panel)
- **Identity Input:** Player name customization
- **START GAUNTLET Button:** Positioned at top with prominent styling
- **ONLINE PK ROOM Panel:** Isolated dark wrapper
  - Create Room section (code generation)
  - Join Room section (code input)
  - Private room toggle
  - Host & Enter / Bind & Enter buttons

### Right Column (Global Chat & Anti-Spam Hub)
- **Chat Panel:** Industrial dark steel terminal box
  - `bg-[#0c0907] border border-zinc-800 h-[260px]`
  - Dedicated "Cổng Chat Thế Giới / Global World Chat" title
  - Active status indicator with pulsing dot
  
### Global Chat Features (`components/ecard/global-chat.tsx`)
- **Independent State:** `globalChat` array, channel: `'global-chat'`
- **No Bleed:** Completely separated from in-game room chat
- **Anti-Spam System:**
  - `maxLength={60}` character limit
  - 3-second cooldown timer (COOLDOWN_MS = 3000)
  - Neon-red border flash on violation
  - Warning badge: "⚠️ SPAM DETECTION: Vui lòng đợi 3 giây!"
  
- **Background Bot Injector:**
  - Simulated recruitment messages every 12 seconds
  - Dynamic text colors from BOT_NAME_COLORS
  - Database user handles: Kaiji_Ito, Tonegawa_CEO, Endou_Loan
  - Populate hub with virtual death-match players ("gạ kèo")

### Performance Optimization
- **Optional Chaining:** All property access uses `?.` operator
- **Safe Fallbacks:** `??` operator for default values
- **Smooth Rendering:** 60fps target maintained
- **Efficient State Management:** Slice messages to last 40 for memory efficiency

---

## 3. INTEGRATION WITH ECARD-GAME.TSX

### Updated Props Passing
```tsx
<Lobby 
  leaderboard={leaderboard} 
  profile={profile}
  servers={servers}
  onStart={startMatch} 
  onProfileNameChange={onProfileNameChange}
  onSaveProfile={onSaveProfile}
/>
```

### Avatar Name Colors (In-Game)
- **Player (Left):** `text-[#9e2a2b]` with blood-red glow
- **Enemy (Right):** `text-[#b3914a]` with gold glow

---

## 4. DESIGN SPECIFICATIONS

### Color Palette
| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| Slave Glow | Blood Red | #9e2a2b | Kẻ Vô Danh avatar & name |
| Emperor Glow | Royal Gold | #b3914a | Hyodo avatar & name |
| Background | Deep Black | #0a0a0d | Torso & head |
| Terminal BG | Dark Steel | #0c0907 | Chat panel |
| Execution Line | Crimson | #ff2222 | Split effect |

### Typography
- **Display Font:** Game titles, avatar names, round indicators
- **Sans Font:** UI labels, chat messages, button text
- **Tracking:** Wide letter-spacing for dramatic effect (0.2em - 0.6em)

### Spacing & Layout
- **Grid Gap:** 8 units (32px)
- **Panel Padding:** 4-6 units (16-24px)
- **Message Spacing:** 1.5 units (6px)
- **Border Radius:** Minimal (rounded-sm to rounded-lg)

---

## 5. FILES MODIFIED

1. `/components/ecard/silhouette.tsx` - Avatar redesign
2. `/components/ecard/lobby.tsx` - Lobby restructuring
3. `/components/ecard/global-chat.tsx` - Chat system upgrade
4. `/components/ecard-game.tsx` - Props integration & color updates

---

## 6. TESTING CHECKLIST

- [ ] Avatar renders without SVG path errors
- [ ] Silhouettes display correct hunched posture
- [ ] Glow effects apply correctly (red for left, gold for right)
- [ ] Lobby displays 2-column grid on desktop
- [ ] Global chat messages appear every 12 seconds
- [ ] Spam detection triggers after 3 messages within 3 seconds
- [ ] Optional chaining prevents rendering crashes
- [ ] 60fps performance maintained during chat updates
- [ ] Split animation works during execution
- [ ] Drill mechanism still advances correctly

---

## 7. FUTURE ENHANCEMENTS

- Add sound effects for chat messages
- Implement user muting/filtering
- Add emoji support with fallback
- Create chat history export
- Add moderator commands for spam control
