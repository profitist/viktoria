"use client";

import { useEffect, useMemo, useState } from "react";

import { helpQuickStart, helpSections } from "@/components/help/helpContent";

function HelpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M7.917 7.5C7.917 6.35 8.9 5.417 10.113 5.417C11.285 5.417 12.25 6.267 12.25 7.333C12.25 8.2 11.724 8.826 10.861 9.365C10.074 9.856 9.583 10.443 9.583 11.25V11.667"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="14.375" r="0.9" fill="currentColor" />
      <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function HelpCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const sectionLinks = useMemo(
    () => helpSections.map((section) => ({ id: section.id, title: section.title })),
    []
  );

  function handleJumpToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Открыть справку"
        title="Справка"
        className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-[#111111]/90 text-white shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-sm transition-transform duration-150 hover:-translate-y-0.5 hover:bg-[#191919] sm:bottom-6 sm:right-6"
      >
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.25),transparent_58%)]" />
        <span className="relative flex items-center justify-center">
          <HelpIcon />
        </span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[60] overflow-y-auto bg-black/70 px-4 py-5 backdrop-blur-sm sm:px-6 sm:py-8"
          role="presentation"
          onMouseDown={() => setIsOpen(false)}
        >
          <div
            className="mx-auto w-full max-w-5xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#0B0B0B] shadow-[0_32px_120px_rgba(0,0,0,0.65)]"
            style={{ maxHeight: "calc(100vh - 40px)" }}
            role="dialog"
            aria-modal="true"
            aria-label="Справка по Victory"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(59,130,246,0.18),rgba(11,11,11,0.96)_42%,rgba(16,185,129,0.10))] px-5 py-5 sm:px-8 sm:py-7">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/55">
                    Справка
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-white sm:text-[30px]">
                    Как пользоваться Victory
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65 sm:text-[15px]">
                    Короткая встроенная документация по основным экранам и возможностям:
                    доски, задачи, комментарии, вложения, уведомления, автоматизация и
                    администрирование workspace.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Закрыть справку"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  ×
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {helpQuickStart.map((item, index) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">
                      Шаг {index + 1}
                    </div>
                    <h3 className="mt-2 text-sm font-medium text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/58">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col lg:flex-row">
              <aside className="hidden w-[240px] flex-shrink-0 border-r border-white/10 bg-[#090909] lg:block">
                <div className="p-5">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/30">
                    Разделы
                  </div>
                  <nav className="mt-4 space-y-2">
                    {sectionLinks.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => handleJumpToSection(section.id)}
                        className="block w-full rounded-xl border border-transparent px-3 py-2 text-left text-sm text-white/58 transition-colors hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                      >
                        {section.title}
                      </button>
                    ))}
                  </nav>
                </div>
              </aside>

              <div className="flex-1 px-5 py-5 sm:px-8 sm:py-7">
                <div className="mb-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
                  {sectionLinks.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => handleJumpToSection(section.id)}
                      className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white"
                    >
                      {section.title}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  {helpSections.map((section) => (
                    <section
                      key={section.id}
                      id={section.id}
                      className="scroll-mt-6 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-5 sm:p-6"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
                          style={{
                            backgroundColor: section.accent,
                            boxShadow: `0 0 24px ${section.accent}55`,
                          }}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <h3 className="text-lg font-medium text-white">{section.title}</h3>
                          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">
                            {section.description}
                          </p>
                          <ul className="mt-4 space-y-2.5">
                            {section.bullets.map((bullet) => (
                              <li
                                key={bullet}
                                className="flex items-start gap-3 text-sm leading-6 text-white/72"
                              >
                                <span
                                  className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                                  style={{ backgroundColor: section.accent }}
                                  aria-hidden="true"
                                />
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
