"use client";

import { FormEvent, useEffect, useState } from "react";
import { canManageStore, StoreRole } from "@/lib/permissions";
import {
  createDiningId,
  DiningConfig,
  loadDiningConfig,
  loadOpenTableOrders,
  saveDiningConfig,
} from "@/lib/repositories/diningRepository";
import styles from "./TableSettings.module.css";

export function TableSettings({ role }: { role: StoreRole }) {
  const editable = canManageStore(role);
  const [config, setConfig] = useState<DiningConfig>({ areas: [], tables: [] });
  const [openTableIds, setOpenTableIds] = useState<Set<string>>(new Set());
  const [areaName, setAreaName] = useState("");
  const [tableNames, setTableNames] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([loadDiningConfig(), loadOpenTableOrders()]).then(([saved, opened]) => {
      setConfig(saved);
      setOpenTableIds(new Set(opened.map((order) => order.tableId)));
    });
  }, []);

  function addArea(event: FormEvent) {
    event.preventDefault();
    const name = areaName.trim();
    if (!name) return;
    const area = { id: createDiningId("area"), name, sortOrder: config.areas.length };
    setConfig((current) => ({ ...current, areas: [...current.areas, area] }));
    setAreaName("");
  }

  function addTable(event: FormEvent, targetAreaId: string) {
    event.preventDefault();
    const name = (tableNames[targetAreaId] ?? "").trim();
    if (!name) return;
    setConfig((current) => ({
      ...current,
      tables: [
        ...current.tables,
        {
          id: createDiningId("table"),
          areaId: targetAreaId,
          name,
          sortOrder: current.tables.length,
          active: true,
        },
      ],
    }));
    setTableNames((current) => ({ ...current, [targetAreaId]: "" }));
  }

  async function save() {
    await saveDiningConfig(config);
    setMessage("Đã lưu.");
  }

  return (
    <section className={styles.card} id="tables">
      <h2>Khu vực & bàn</h2>
      {!editable && <p className={styles.notice}>Chỉ chủ hoặc quản lý được thay đổi.</p>}

      {editable && (
        <div className={styles.builders}>
          <form onSubmit={addArea}>
            <label>
              <span>Khu vực</span>
              <input
                value={areaName}
                onChange={(event) => setAreaName(event.target.value)}
                placeholder="Sân trước"
              />
            </label>
            <button>THÊM KHU VỰC</button>
          </form>
        </div>
      )}

      <div className={styles.areas}>
        {config.areas.map((area) => (
          <section key={area.id}>
            <input
              aria-label="Tên khu vực"
              value={area.name}
              disabled={!editable}
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  areas: current.areas.map((item) =>
                    item.id === area.id ? { ...item, name: event.target.value } : item,
                  ),
                }))
              }
            />

            {editable && (
              <form className={styles.areaTableBuilder} onSubmit={(event) => addTable(event, area.id)}>
                <label>
                  <span>Thêm bàn vào khu vực này</span>
                  <input
                    value={tableNames[area.id] ?? ""}
                    onChange={(event) =>
                      setTableNames((current) => ({
                        ...current,
                        [area.id]: event.target.value,
                      }))
                    }
                    placeholder="Bàn 01"
                  />
                </label>
                <button>THÊM BÀN</button>
              </form>
            )}

            <div>
              {config.tables
                .filter((table) => table.areaId === area.id)
                .map((table) => (
                  <article key={table.id}>
                    <input
                      aria-label="Tên bàn"
                      value={table.name}
                      disabled={!editable}
                      onChange={(event) =>
                        setConfig((current) => ({
                          ...current,
                          tables: current.tables.map((item) =>
                            item.id === table.id ? { ...item, name: event.target.value } : item,
                          ),
                        }))
                      }
                    />
                    <button
                      type="button"
                      disabled={!editable || openTableIds.has(table.id)}
                      onClick={() =>
                        setConfig((current) => ({
                          ...current,
                          tables: current.tables.map((item) =>
                            item.id === table.id ? { ...item, active: !item.active } : item,
                          ),
                        }))
                      }
                    >
                      {table.active ? "ẨN" : "HIỆN"}
                    </button>
                    {openTableIds.has(table.id) && <small>Đang có khách</small>}
                  </article>
                ))}
            </div>
          </section>
        ))}
      </div>

      {config.areas.length === 0 && <div className={styles.empty}>Tạo khu vực trước để thêm bàn.</div>}
      {message && <p className={styles.message}>{message}</p>}
      {editable && (
        <button className={styles.save} type="button" onClick={save}>
          LƯU
        </button>
      )}
    </section>
  );
}
