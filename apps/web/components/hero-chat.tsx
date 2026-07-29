"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import Image from "next/image";
import { useRef } from "react";

const usdcLogo =
  "https://cdn.prod.website-files.com/67116d0daddc92483c812e88/69dd40a9c133b5cb988d31b4_logo%20%286%29.avif";

export function HeroChat(): React.ReactElement {
  const root = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const steps = gsap.utils.toArray<HTMLElement>("[data-chat-step]");
      timeline.current = gsap
        .timeline({ delay: 0.25 })
        .fromTo(
          steps,
          { autoAlpha: 0, y: 14 },
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.56,
            stagger: 0.82,
            ease: "power3.out",
          },
        )
        .fromTo(
          "[data-payment-mark]",
          { scale: 0.82, rotate: -8 },
          { scale: 1, rotate: 0, duration: 0.62, ease: "back.out(1.7)" },
          "<",
        );
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
            <p>Read this page and give me the key points.</p>
            <span className="chat-link">/agent/page/research-note</span>
          </article>

          <article className="chat-message chat-agent" data-chat-step>
            <span className="chat-author">PayCrawl agent</span>
            <p>This page costs 0.001 USDC on Celo. It is within your limit.</p>
          </article>

          <article className="chat-payment" data-chat-step>
            <div className="payment-token">
              <Image
                src={usdcLogo}
                alt="USDC"
                width={32}
                height={32}
                data-payment-mark
              />
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
            <p>Paid. I read the page and saved the payment receipt.</p>
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
