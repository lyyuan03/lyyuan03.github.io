# 靈元院網站｜版本鎖定系統（Version Lock System）

## 🧭 系統目的
避免首頁設計被意外覆寫，確保網站永遠可回復到穩定版本。

---

## 📌 分支規則

### 1️⃣ main（對外發布版）
- GitHub Pages 讀取來源
- 僅放「穩定可公開版本」
- 禁止直接大幅改動 UI

### 2️⃣ production-lock（設計鎖定版）
- 每次重大版本會同步備份
- 作為「可回復基準點」
- UI 改動前必須先同步到此分支

---

## 🔒 操作規則

### 修改流程
1. 先備份到 production-lock
2. 再修改 main
3. 如出錯 → 直接覆蓋回 production-lock

---

## 🚨 緊急回復指令

若網站異常：

```bash
git checkout production-lock
git push origin main --force
```

---

## 🧘 設計原則

- UI 改動需可回復
- 每次改版需保留歷史版本
- 禁止無版本備份的直接覆寫

---

## 📍 現行策略

- main：線上版本
- production-lock：穩定基準版本（鎖定點）
