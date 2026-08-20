"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { canManageMembers, canManageStore, StoreRole } from "@/lib/permissions";
import { LogoutButton } from "@/components/LogoutButton";
import styles from "./StoreProfile.module.css";

type StoreProfile = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  role: StoreRole;
};

type StoreMember = {
  userId: string;
  displayName: string;
  phone: string | null;
  role: StoreRole;
  status: "active" | "disabled";
};

const ROLE_LABELS: Record<StoreRole, string> = {
  owner: "Chủ cửa hàng",
  manager: "Quản lý",
  cashier: "Thu ngân"
};

export default function StoreProfilePage() {
  const router = useRouter();
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [members, setMembers] = useState<StoreMember[]>([]);
  const [memberName, setMemberName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [memberPin, setMemberPin] = useState("");
  const [memberRole, setMemberRole] = useState<"manager" | "cashier">("cashier");
  const [memberBusy, setMemberBusy] = useState("");
  const [memberMessage, setMemberMessage] = useState("");
  const [memberError, setMemberError] = useState("");
  const [resetMemberId, setResetMemberId] = useState("");
  const [resetPin, setResetPin] = useState("");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  async function loadMembers(storeId: string) {
    const response = await fetch(`/api/stores/members?storeId=${encodeURIComponent(storeId)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({})) as { members?: StoreMember[]; error?: string };
    if (!response.ok) throw new Error(payload.error || "Chưa thể tải danh sách nhân viên.");
    setMembers(payload.members ?? []);
  }

  useEffect(() => {
    setIsNew(new URLSearchParams(window.location.search).get("new") === "1");
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((account: { stores?: StoreProfile[]; isPlatformAdmin?: boolean; error?: string }) => {
        const current = account.stores?.[0];
        if (!current) throw new Error(account.error || "Không tìm thấy cửa hàng.");
        setIsPlatformAdmin(account.isPlatformAdmin === true);
        setStore(current);
        setName(current.name);
        setPhone(current.phone ?? "");
        setAddress(current.address ?? "");
        if (canManageMembers(current.role)) void loadMembers(current.id).catch((caught) => setMemberError(caught instanceof Error ? caught.message : "Chưa thể tải danh sách nhân viên."));
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Chưa thể tải cửa hàng."));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!store || !canManageStore(store.role)) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/stores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: store.id, name, phone, address })
      });
      const payload = await response.json().catch(() => ({})) as StoreProfile & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Chưa thể lưu thông tin cửa hàng.");
      setStore({ ...store, ...payload });
      if (isNew) {
        router.push("/setup");
        router.refresh();
      } else {
        setMessage("Đã lưu thông tin dùng để in hóa đơn.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chưa thể lưu thông tin cửa hàng.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!store || !canManageMembers(store.role)) return;
    setMemberBusy("new");
    setMemberMessage("");
    setMemberError("");
    try {
      const response = await fetch("/api/stores/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: store.id, name: memberName, phone: memberPhone, pin: memberPin, role: memberRole })
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Chưa thể thêm nhân viên.");
      setMemberName("");
      setMemberPhone("");
      setMemberPin("");
      setMemberRole("cashier");
      await loadMembers(store.id);
      setMemberMessage("Đã cấp quyền. Nhân viên có thể đăng nhập bằng số điện thoại và PIN vừa tạo.");
    } catch (caught) {
      setMemberError(caught instanceof Error ? caught.message : "Chưa thể thêm nhân viên.");
    } finally {
      setMemberBusy("");
    }
  }

  async function updateMember(member: StoreMember, role: "manager" | "cashier", status: "active" | "disabled", pin = "") {
    if (!store || !canManageMembers(store.role)) return;
    setMemberBusy(member.userId);
    setMemberMessage("");
    setMemberError("");
    try {
      const response = await fetch("/api/stores/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: store.id, userId: member.userId, role, status, pin })
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Chưa thể cập nhật quyền.");
      await loadMembers(store.id);
      setResetMemberId("");
      setResetPin("");
      setMemberMessage(pin ? "Đã đặt PIN mới và đăng xuất các phiên cũ của nhân viên." : status === "disabled" ? "Đã ngừng quyền truy cập của nhân viên." : "Đã cập nhật quyền nhân viên.");
    } catch (caught) {
      setMemberError(caught instanceof Error ? caught.message : "Chưa thể cập nhật quyền.");
    } finally {
      setMemberBusy("");
    }
  }

  const editable = canManageStore(store?.role ?? null);

  return (
    <main className={styles.screen}>
      <section className={styles.card}>
        <header className={styles.heading}>
          <div><h1>Thông tin cửa hàng</h1><p>Thông tin này sẽ xuất hiện trên hóa đơn in cho khách.</p></div>
          {!isNew && <div className={styles.headingLinks}>{isPlatformAdmin && <Link className={styles.adminLink} href="/admin">Quản trị VERO</Link>}<Link className={styles.back} href="/">Về bán hàng</Link></div>}
        </header>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}><span>Tên cửa hàng</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={160} required disabled={!editable} /></label>
          <label className={styles.field}><span>Số điện thoại</span><input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={32} inputMode="tel" required disabled={!editable} /></label>
          <label className={`${styles.field} ${styles.fieldAddress}`}><span>Địa chỉ</span><textarea value={address} onChange={(event) => setAddress(event.target.value)} maxLength={240} required disabled={!editable} /></label>
          {store && <p className={styles.role}>Quyền hiện tại: <strong>{ROLE_LABELS[store.role]}</strong>{!editable ? " · Chỉ được xem thông tin." : ""}</p>}
          {message && <p className={styles.message} role="status">{message}</p>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          {editable && <button className={styles.submit} type="submit" disabled={busy || !name.trim() || !phone.trim() || !address.trim()}>{busy ? "ĐANG LƯU..." : isNew ? "LƯU VÀ THÊM MÓN" : "LƯU THÔNG TIN"}</button>}
        </form>
      </section>
      {store && canManageMembers(store.role) && !isNew && (
        <section className={`${styles.card} ${styles.membersCard}`}>
          <header className={styles.heading}>
            <div><h2>Nhân viên & phân quyền</h2><p>Chủ tạo số điện thoại và PIN 6 số cho từng nhân viên.</p></div>
          </header>
          <form className={styles.memberForm} onSubmit={handleAddMember}>
            <label className={styles.field}><span>Tên nhân viên</span><input value={memberName} onChange={(event) => setMemberName(event.target.value)} placeholder="Nguyễn Văn A" maxLength={120} required /></label>
            <label className={styles.field}><span>Số điện thoại</span><input value={memberPhone} onChange={(event) => setMemberPhone(event.target.value)} inputMode="tel" placeholder="090 123 4567" maxLength={32} required /></label>
            <label className={styles.field}><span>PIN 6 số</span><input type="password" value={memberPin} onChange={(event) => setMemberPin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="••••••" pattern="[0-9]{6}" required /></label>
            <label className={styles.field}><span>Vai trò</span><select value={memberRole} onChange={(event) => setMemberRole(event.target.value as "manager" | "cashier")}><option value="cashier">Thu ngân</option><option value="manager">Quản lý</option></select></label>
            <button className={styles.addMember} type="submit" disabled={memberBusy === "new" || !memberName.trim() || !memberPhone.trim() || memberPin.length !== 6}>{memberBusy === "new" ? "ĐANG THÊM..." : "THÊM NHÂN VIÊN"}</button>
          </form>
          {memberMessage && <p className={styles.message} role="status">{memberMessage}</p>}
          {memberError && <p className={styles.error} role="alert">{memberError}</p>}
          <div className={styles.memberList}>
            {members.map((member) => (
              <article className={`${styles.member} ${member.status === "disabled" ? styles.memberDisabled : ""}`} key={member.userId}>
                <div className={styles.memberIdentity}><strong>{member.displayName}</strong><span>{member.phone}</span></div>
                {member.role === "owner" ? (
                  <span className={styles.ownerBadge}>Chủ cửa hàng</span>
                ) : (
                  <>
                    <select aria-label={`Vai trò của ${member.phone}`} value={member.role} disabled={memberBusy === member.userId || member.status === "disabled"} onChange={(event) => void updateMember(member, event.target.value as "manager" | "cashier", member.status)}><option value="cashier">Thu ngân</option><option value="manager">Quản lý</option></select>
                    <div className={styles.memberActions}><button className={styles.resetMember} type="button" disabled={memberBusy === member.userId || member.status === "disabled"} onClick={() => { setResetMemberId(member.userId); setResetPin(""); }}>ĐẶT LẠI PIN</button><button className={member.status === "active" ? styles.disableMember : styles.enableMember} type="button" disabled={memberBusy === member.userId} onClick={() => void updateMember(member, member.role as "manager" | "cashier", member.status === "active" ? "disabled" : "active")}>{memberBusy === member.userId ? "ĐANG LƯU..." : member.status === "active" ? "NGỪNG QUYỀN" : "CẤP LẠI QUYỀN"}</button></div>
                    {resetMemberId === member.userId && <div className={styles.resetPanel}><input aria-label="PIN mới" type="password" inputMode="numeric" value={resetPin} onChange={(event) => setResetPin(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="PIN mới 6 số" /><button type="button" disabled={resetPin.length !== 6} onClick={() => void updateMember(member, member.role as "manager" | "cashier", member.status, resetPin)}>LƯU PIN MỚI</button></div>}
                  </>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      {!isNew && <LogoutButton className={styles.mobileLogout} />}
    </main>
  );
}
