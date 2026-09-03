"use client";

import Link from "next/link";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";

const FAQ_KEYS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10"];

export default function BantuanPage() {
  const { t } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <>
      <div className="bantuan-section">
        <div className="bantuan-faq-header">
          <p className="bantuan-faq-eyebrow">{t("bantuan.eyebrow")}</p>
          <h2 className="bantuan-faq-title">{t("bantuan.title")}</h2>
        </div>
        <div className="faq-list">
          {FAQ_KEYS.map((key, index) => {
            const open = openFaq === index;
            return (
              <div key={key} className={`faq-item${open ? " faq-item-open" : ""}`}>
                <button
                  type="button"
                  className="faq-item-trigger"
                  aria-expanded={open}
                  onClick={() => setOpenFaq(open ? null : index)}
                >
                  <span>{t(`bantuan.${key}.question`)}</span>
                  <svg className="faq-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div className="faq-item-answer">
                  <p>{t(`bantuan.${key}.answer`)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bantuan-cta">
        <div>
          <h4>{t("bantuan.ctaTitle")}</h4>
          <p>{t("bantuan.ctaText")}</p>
        </div>
        <Link className="bantuan-cta-btn" href="/contact-person">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          {t("nav.contactPerson")}
        </Link>
      </div>
    </>
  );
}
