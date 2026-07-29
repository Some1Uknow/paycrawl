"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import Image from "next/image";
import { useRef } from "react";

const celoLogo = "https://cryptologos.cc/logos/celo-celo-logo.png";
const usdcLogo =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Circle_USDC_Logo.svg/1280px-Circle_USDC_Logo.svg.png";

export function HeroChat(): React.ReactElement {
  const root = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const steps = gsap.utils.toArray<HTMLElement>("[data-chat-step]");
      const typedText = gsap.utils.toArray<HTMLElement>("[data-typing]");
      const sourceText = typedText.map((element) => element.textContent ?? "");

      typedText.forEach((element) => {
        element.textContent = "";
      });

      const sequence = gsap.timeline({ delay: 0.25 });
      steps.forEach((step) => {
        sequence.fromTo(
          step,
          { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, duration: 0.45, ease: "power3.out" },
        );

        if (step.classList.contains("chat-payment")) {
          sequence.fromTo(
            "[data-payment-mark]",
            { scale: 0.82, rotate: -8 },
            {
              scale: 1,
              rotate: 0,
              duration: 0.62,
              ease: "back.out(1.7)",
            },
            "<",
          );
        }

        const text = step.querySelector<HTMLElement>("[data-typing]");
        if (!text) return;

        const copy = sourceText[typedText.indexOf(text)] ?? "";
        const progress = { characters: 0 };
        sequence.to(progress, {
          characters: copy.length,
          duration: Math.max(0.42, copy.length * 0.014),
          ease: "none",
          onUpdate: () => {
            text.textContent = copy.slice(0, Math.round(progress.characters));
          },
        });
      });

      timeline.current = sequence;
    },
    { scope: root },
  );

  function replay(): void {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timeline.current?.restart();
  }

  return (
    <div className="hero-chat-shell" ref={root} data-motion-media data-reveal>
      <section
        className="hero-chat"
        aria-label="Example PayCrawl agent conversation"
      >
        <header className="chat-header">
          <div>
            <strong>PayCrawl agent</strong>
            <span>Example payment flow</span>
          </div>
          <button className="chat-replay" type="button" onClick={replay}>
            Replay
          </button>
        </header>

        <div className="chat-thread">
          <article className="chat-message chat-user" data-chat-step>
            <span className="chat-author">You</span>
            <p data-typing>Read this page and give me the key points.</p>
            <span className="chat-link">/agent/page/research-note</span>
          </article>

          <article className="chat-message chat-agent" data-chat-step>
            <span className="chat-author">PayCrawl agent</span>
            <p data-typing>
              This page costs 0.001 USDC on Celo. It is within your limit.
            </p>
          </article>

          <article className="chat-payment" data-chat-step>
            <div className="payment-token">
              <div className="payment-token-marks" data-payment-mark>
                <Image src={celoLogo} alt="Celo" width={32} height={32} />
                <Image src={usdcLogo} alt="USDC" width={32} height={32} />
              </div>
              <div>
                <strong>0.001 USDC</strong>
                <span>Celo mainnet</span>
              </div>
            </div>
            <span className="payment-status">
              <i aria-hidden="true" /> Payment approved
            </span>
          </article>

          <article
            className="chat-message chat-agent chat-result"
            data-chat-step
          >
            <span className="chat-author">PayCrawl agent</span>
            <p data-typing>
              Paid. I read the page and saved the payment receipt.
            </p>
            <div className="content-received">
              <strong>Content received</strong>
              <span>Ready to summarize or use in the next step.</span>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
