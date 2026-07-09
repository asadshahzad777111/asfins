"use client";

import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { Inquiry } from "@/lib/inquiries/types";

interface InquiriesAdminProps {
  initialInquiries: Inquiry[];
}

export function InquiriesAdmin({ initialInquiries }: InquiriesAdminProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-charcoal">{t("adminInquiriesTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("adminInquiriesSubtitle")}</p>
      </div>

      {initialInquiries.length === 0 ? (
        <p className="rounded-sm border border-divider bg-marble p-6 text-sm text-muted">
          {t("emptyInquiries")}
        </p>
      ) : (
        <div className="space-y-3">
          {initialInquiries.map((inq) => (
            <div key={inq.id} className="rounded-sm border border-divider bg-marble p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-display text-sm">{inq.name}</p>
                  <p className="font-mono-data text-xs text-muted">{inq.phone}</p>
                </div>
                <p className="font-mono-data text-[10px] text-muted">
                  {new Date(inq.createdAt).toLocaleString()}
                </p>
              </div>
              {inq.sceneName && (
                <p className="mt-2 text-xs text-brass">
                  {t("sceneLabel", { name: inq.sceneName })}
                </p>
              )}
              {inq.zoneSummary && (
                <p className="mt-1 text-xs text-muted">{inq.zoneSummary}</p>
              )}
              <p className="mt-2 whitespace-pre-wrap text-sm">{inq.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
