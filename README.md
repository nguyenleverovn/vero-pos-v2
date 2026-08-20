# VERO POS V2

VERO POS V2 duoc tach tu ban V1 on dinh de phat trien tai khoan, du lieu cloud,
khoi phuc tren thiet bi moi va dong bo offline.

## Hai phien ban chay song song

- V1: `https://pos.verocoffeeshop.vn`
- V2 thu nghiem: `https://posv2.verocoffeeshop.vn`
- Repo V1: `nguyenleverovn/vero-pos`
- Repo V2: `nguyenleverovn/vero-pos-v2`
- Moc ma nguon V1 trong repo nay: tag `v1-baseline`

V1 va V2 phai co thu muc deploy, service, bien moi truong va database rieng.
Khong thay the hoac migrate du lieu V1 khi V2 chua duoc Founder phe duyet.

## Nguyen tac kien truc

- PostgreSQL va backend giu du lieu that va quyen truy cap.
- Frontend khong ket noi truc tiep PostgreSQL.
- IndexedDB la cache va hang doi offline tren tung thiet bi.
- Moi lenh ghi co `client_mutation_id` de chong tao trung khi retry.
- Don da hoan tat la ban ghi tai chinh, khong tu dong merge khi xung dot.
- Session dang nhap dung cookie `HttpOnly`, `Secure`, `SameSite`.
- Backup ma hoa duoc luu ngoai VPS va phai co bai thu khoi phuc.

Tai lieu nen:

- `docs/v2/architecture.md`
- `docs/v2/data-model.md`
- `database/migrations/001_v2_foundation.sql`

## Thu tu trien khai

1. Data model va sync contract.
2. Tai khoan, session va cua hang.
3. Thanh vien va phan quyen.
4. Dong bo danh muc va san pham.
5. Dong bo don hang.
6. Khoi phuc tren may moi.
7. Offline outbox va retry.
8. Import CSV/XLSX neu du lieu su dung xac nhan nhu cau.

## Quy trinh Git

- `main` chi chua code on dinh.
- Phat trien qua `feature/*`, `fix/*` hoac `refactor/*`.
- PR can co `What changed`, `Why`, `Testing`.
- Chay `npm run lint` va `npm run build` truoc khi merge PR co thay doi code.
- Squash merge; khong merge hoac deploy neu chua duoc phe duyet.

## Chay local

```bash
npm install
npm run dev
```
