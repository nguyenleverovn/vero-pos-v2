# VERO POS V2 Data Model v1

## Thuc the cot loi

### users

Danh tinh cua nguoi su dung. Email va so dien thoai thuoc ve khach, khong dung
email/hotline cua VERO lam danh tinh cua cua hang.

### auth_sessions

Session dang nhap da hash, co han su dung va co the thu hoi.

### stores

Cua hang doc lap va la ranh gioi du lieu chinh.

### store_memberships

Lien ket user voi store va role `owner`, `manager` hoac `cashier`.

### devices

Theo doi thiet bi, sync cursor va thoi diem dong bo gan nhat. Device khong phai
la danh tinh nguoi dung va khong tu cap quyen.

### categories va products

Menu cua tung store. Gia luu bang so nguyen VND, khong dung floating point.
`version` dung de phat hien ghi de du lieu cu; `deleted_at` ho tro soft delete.

### orders va order_items

Don hang va snapshot ten/gia san pham tai thoi diem ban. Bao cao lich su khong
phu thuoc vao ten/gia san pham hien tai.

### sync_mutations

Nhat ky idempotency cho lenh ghi tu thiet bi. Cung mot
`store_id + client_mutation_id` chi duoc xu ly mot lan.

### sync_changes

Chuoi thay doi de thiet bi pull theo cursor ma khong tai lai toan bo database.

## Quy tac bat buoc

1. Moi ban ghi nghiep vu thuoc dung mot `store_id`.
2. API phai kiem tra membership truoc khi truy cap store.
3. Money dung `bigint` theo VND.
4. Don da `completed` khong sua tong tien hoac item.
5. Order item luu snapshot ten, don gia va danh muc.
6. Moi mutation offline co UUID idempotency.
7. Moi ban ghi dong bo co `version`, `created_at`, `updated_at`.
8. Xoa category/product la soft delete de thiet bi khac nhan duoc tombstone.
9. Timestamp luu `timestamptz`; hien thi theo timezone cua store.
10. Backup khong duoc nam duy nhat tren cung VPS voi database.

## Khong lam trong foundation

- Ton kho va nguyen lieu.
- Ke toan, hoa don dien tu va cong no.
- Chuong trinh thanh vien/CRM.
- Nhieu chi nhanh trong mot bao cao hop nhat.
- Tu dong import CSV/XLSX.
- Dong bo hai chieu voi n8n hoac Notion.

Nhung phan nay chi mo khi co nhu cau van hanh thuc te va du lieu xac nhan.
