"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { Catalog } from "@/lib/catalogs/types";
import type { SceneRecord, ZonePalette } from "@/lib/scenes/types";
import { SceneSetupWizard } from "@/components/admin/SceneSetupWizard";

interface ScenesAdminProps {
  initialScenes: SceneRecord[];
  catalogs: Catalog[];
}

export function ScenesAdmin({ initialScenes, catalogs }: ScenesAdminProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [scenes, setScenes] = useState(initialScenes);
  const [showWizard, setShowWizard] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function paletteLabel(palette: ZonePalette) {
    if (palette === "wood") return t("paletteWood");
    if (palette === "tile") return t("paletteTile");
    return t("palettePaint");
  }

  async function handleDelete(id: string) {
    if (!confirm(t("deleteSceneConfirm"))) return;
    const res = await fetch(`/api/admin/scenes?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setScenes((s) => s.filter((sc) => sc.id !== id));
      setMessage({ type: "ok", text: t("deleteSceneSuccess") });
      router.refresh();
    }
  }

  return (
    <>
      {message && (
        <div
          className={`wp-notice${
            message.type === "ok" ? " wp-notice--success" : " wp-notice--error"
          }`}
          style={{ marginBottom: "1rem" }}
        >
          {message.text}
        </div>
      )}

      {!showWizard ? (
        <div className="wp-toolbar" style={{ marginBottom: "1rem" }}>
          <div className="wp-toolbar-left">
            <button type="button" className="wp-button" onClick={() => setShowWizard(true)}>
              {t("wizardNewScene")}
            </button>
          </div>
        </div>
      ) : (
        <SceneSetupWizard
          catalogs={catalogs}
          onComplete={async () => {
            setShowWizard(false);
            const res = await fetch("/api/admin/scenes");
            if (res.ok) {
              const data = await res.json();
              setScenes(data.scenes);
            }
            router.refresh();
          }}
          onCancel={() => setShowWizard(false)}
        />
      )}

      <div className="wp-postbox">
        <div className="wp-postbox-head">{t("existingScenes", { count: scenes.length })}</div>
        <div className="wp-postbox-body">
          {scenes.length === 0 ? (
            <p className="wp-empty">{t("emptyGallery")}</p>
          ) : (
            <div className="wp-table-wrap">
              <table className="wp-table">
                <thead>
                  <tr>
                    <th />
                    <th>{t("kitchenName")}</th>
                    <th>{t("roomCategory")}</th>
                    <th>{t("colourZones")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {scenes.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.thumbnail} alt={s.name} className="wp-table-thumb" />
                      </td>
                      <td>
                        <div className="wp-row-title">{s.name}</div>
                        <div className="text-xs text-muted">{s.id}</div>
                      </td>
                      <td>{s.category}</td>
                      <td>
                        <ul className="text-xs" style={{ margin: 0, paddingLeft: "1rem" }}>
                          {s.zones.map((z) => (
                            <li key={z.id}>
                              {z.label} ({paletteLabel(z.palette)})
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>
                        <div className="wp-row-actions">
                          <a href={`/configurator/${s.id}`} target="_blank" rel="noreferrer">
                            {t("preview")}
                          </a>
                          <span>|</span>
                          <button type="button" onClick={() => void handleDelete(s.id)}>
                            {t("delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
