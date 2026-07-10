"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { HelpCircle, X, Sparkles } from "lucide-react";
import { toursForPath, type TourStep } from "@/lib/help/tours";
import { cn } from "@/lib/utils";

const CARD_WIDTH = 320;
const SUMMARY_WIDTH = 380;
const CARD_MARGIN = 12;

/**
 * Contextual help — a "?" trigger (rendered in the header) that walks
 * the current screen's registered steps (see src/lib/help/tours.ts)
 * one at a time: a highlight ring around the relevant element plus a
 * floating card explaining it, with Next/Back controls. The last step
 * of every tour is a "summary" — a larger, centered recap of the
 * screen's real business value instead of one more element callout.
 *
 * Anchors by CSS selector and re-measures on resize/scroll so the
 * highlight tracks the real element instead of a hardcoded position.
 */
export function HelpTourButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const steps = toursForPath(pathname, search ? `?${search}` : undefined);

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step: TourStep | undefined = steps?.[stepIndex];
  const isSummary = step?.kind === "summary";

  const measure = useCallback(() => {
    if (!step || step.kind === "summary") {
      setRect(null);
      return;
    }
    const el = document.querySelector(step.selector);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useLayoutEffect(() => {
    if (!active) return;
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, measure]);

  // Leaving the page (or the tour finishing) resets progress so the
  // next open always starts from step 1.
  useEffect(() => {
    setActive(false);
    setStepIndex(0);
  }, [pathname, search]);

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => {
          setStepIndex(0);
          setActive(true);
        }}
        aria-label="Ajuda desta tela"
        title="Ajuda desta tela"
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <HelpCircle className="h-[18px] w-[18px]" />
      </button>
    );
  }

  const close = () => setActive(false);
  const next = () => {
    if (!steps || stepIndex + 1 >= steps.length) {
      close();
      return;
    }
    setStepIndex((i) => i + 1);
  };
  const prev = () => setStepIndex((i) => Math.max(0, i - 1));

  // Card placement: below the target when there's room, otherwise
  // above it — but always clamped inside the viewport (a tall target
  // like the conversation list can otherwise push the card off either
  // edge). Estimated height covers this card's actual content range.
  // Summary steps have no target — always centered.
  const ESTIMATED_CARD_HEIGHT = 200;
  const width = isSummary ? SUMMARY_WIDTH : CARD_WIDTH;
  let cardStyle: React.CSSProperties = {
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  };
  if (rect && !isSummary && typeof window !== "undefined") {
    const left = Math.min(
      Math.max(CARD_MARGIN, rect.left),
      window.innerWidth - width - CARD_MARGIN,
    );
    let top = rect.bottom + CARD_MARGIN;
    if (top + ESTIMATED_CARD_HEIGHT > window.innerHeight - CARD_MARGIN) {
      top = rect.top - CARD_MARGIN - ESTIMATED_CARD_HEIGHT;
    }
    top = Math.min(
      Math.max(CARD_MARGIN, top),
      window.innerHeight - ESTIMATED_CARD_HEIGHT - CARD_MARGIN,
    );
    cardStyle = { top, left };
  }

  return (
    <>
      <button
        type="button"
        onClick={close}
        aria-label="Ajuda desta tela"
        title="Ajuda desta tela"
        className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-soft text-primary"
      >
        <HelpCircle className="h-[18px] w-[18px]" />
      </button>

      <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true">
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div className="absolute inset-0 bg-black/55" onClick={close} />

        {rect && !isSummary && (
          <div
            className="pointer-events-none absolute rounded-lg ring-2 ring-primary transition-[top,left,width,height] duration-150"
            style={{
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
            }}
          />
        )}

        <div
          className={cn(
            "absolute rounded-xl border border-border bg-popover text-popover-foreground shadow-xl",
            isSummary ? "p-5" : "p-4",
          )}
          style={{ width, ...cardStyle }}
        >
          {!step && (
            <>
              <p className="text-sm text-muted-foreground">
                Ainda não há um tutorial para esta tela.
              </p>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Fechar
                </button>
              </div>
            </>
          )}

          {step && step.kind === "summary" && (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Sparkles className="size-4" />
                  </span>
                  <h3 className="text-base font-semibold">{step.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Fechar ajuda"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2.5 text-sm text-muted-foreground">{step.intro}</p>
              <ul className="mt-3.5 flex flex-col gap-2.5">
                {step.bullets.map((b) => (
                  <li
                    key={b.label}
                    className="rounded-lg border border-border bg-muted/40 px-3 py-2"
                  >
                    <p className="text-[13px] font-semibold text-foreground">{b.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{b.detail}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {stepIndex + 1} / {steps!.length}
                </span>
                <div className="flex gap-2">
                  {stepIndex > 0 && (
                    <button
                      type="button"
                      onClick={prev}
                      className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                    >
                      Voltar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            </>
          )}

          {step && step.kind !== "summary" && (
            <>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold">{step.title}</h3>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Fechar ajuda"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {stepIndex + 1} / {steps!.length}
                </span>
                <div className="flex gap-2">
                  {stepIndex > 0 && (
                    <button
                      type="button"
                      onClick={prev}
                      className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                    >
                      Voltar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={next}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
