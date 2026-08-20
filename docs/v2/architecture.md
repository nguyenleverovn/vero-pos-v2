# VERO POS V2 Architecture

## Muc tieu

Khach dang nhap bang thong tin cua ho, doi may van lay lai menu va don hang,
nhieu nhan vien co the dung cung mot cua hang, va mat Internet van tiep tuc ban.

## Ranh gioi quyen han

```text
Next.js UI
  |
  | HTTPS + HttpOnly session
  v
VERO POS API
  |
  | transaction + authorization + idempotency
  v
PostgreSQL

IndexedDB tren thiet bi
  - cache danh muc/san pham
  - draft dang ban
  - outbox cho lenh chua dong bo
  - sync cursor cua thiet bi
```

- PostgreSQL la source of truth cho tai khoan, cua hang, quyen, san pham va don.
- API kiem tra membership cua moi request; UI khong tu quyet dinh quyen.
- IndexedDB giup ung dung hoat dong khi mat mang, khong thay the backup cloud.
- n8n hoac automation chi nhan event sau commit; khong ghi giao dich cot loi.

## Session va quyen

- Mat khau chi luu dang hash bang thuat toan phu hop tai thoi diem trien khai.
- Session token chi gui trong cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
- Database chi luu hash cua session token.
- Role ban dau: `owner`, `manager`, `cashier`.
- Backend nap membership hien tai truoc moi lenh doc/ghi du lieu cua cua hang.
- Doi role, khoa user hoac thu hoi session co hieu luc tu backend.

## Dong bo

### Push

Moi mutation tu thiet bi gom:

- `client_mutation_id`: UUID tao mot lan tren thiet bi.
- `device_id`: thiet bi tao lenh.
- `base_version`: version ma thiet bi da sua tu do.
- payload cua thao tac.

Backend ghi transaction va tra lai cung ket qua neu mutation bi retry.

### Pull

- Moi cua hang co chuoi thay doi tang dan trong `sync_changes`.
- Thiet bi gui cursor cuoi cung va nhan cac thay doi moi hon cursor.
- Cursor chi duoc cap nhat sau khi IndexedDB ghi thanh cong toan bo batch.

### Xung dot

- Danh muc/san pham: backend tu choi `base_version` cu va tra ban moi nhat.
- Draft chua thanh toan co the tiep tuc o thiet bi tao draft.
- Don da hoan tat khong ghi de hoac tu dong merge.
- Lenh tao don dung `client_mutation_id` va `idempotency_key` de khong tao hai don.

## Backup va khoi phuc

- Backup PostgreSQL ma hoa toi kho object storage tach khoi VPS.
- Chay backup moi ngay va giu toi thieu 30 ngay.
- Kiem tra kha nang restore tren moi truong rieng moi thang.
- Khong ghi secret, token hoac database dump vao Git.
- May moi dang nhap, chon cua hang va pull snapshot/cursor tu backend.

## Bien moi truong du kien

```text
DATABASE_URL
SESSION_SECRET
BACKUP_BUCKET
BACKUP_ENDPOINT
BACKUP_ACCESS_KEY_ID
BACKUP_SECRET_ACCESS_KEY
```

Gia tri that chi dat tren server hoac secret manager.

## Cong trien khai

V1 va V2 phai tach hoan toan:

| Thanh phan | V1 | V2 |
| --- | --- | --- |
| Domain | `pos.verocoffeeshop.vn` | `posv2.verocoffeeshop.vn` |
| Repo | `vero-pos` | `vero-pos-v2` |
| Thu muc deploy | rieng | rieng |
| systemd service | rieng | rieng |
| Port noi bo | rieng | rieng |
| Database | IndexedDB V1 | PostgreSQL V2 + IndexedDB cache |

Khong doi Caddy route cua V1 khi deploy V2.
