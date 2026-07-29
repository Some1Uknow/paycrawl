"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger);

type MotionProps = {
  children: React.ReactNode;
  className?: string;
};

export function MotionReveal({
  children,
  className,
}: MotionProps): React.ReactElement {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const items = gsap.utils.toArray<HTMLElement>("[data-reveal]");
      gsap.fromTo(
        items,
        { autoAlpha: 0, y: 14 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.68,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: {
            trigger: root.current,
            start: "top 82%",
            once: true,
          },
        },
      );

      const media = gsap.utils.toArray<HTMLElement>("[data-motion-media]");
      media.forEach((element) => {
        gsap.fromTo(
          element,
          { autoAlpha: 0.76, scale: 0.96 },
          {
            autoAlpha: 1,
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: element,
              start: "top 88%",
              end: "bottom 24%",
              scrub: 0.35,
            },
          },
        );
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}

export function PinnedGallery({
  children,
  className,
}: MotionProps): React.ReactElement {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const heading = root.current?.querySelector<HTMLElement>(
        "[data-gallery-heading]",
      );
      if (!heading) return;

      const mediaQuery = gsap.matchMedia();
      mediaQuery.add("(min-width: 841px)", () => {
        ScrollTrigger.create({
          trigger: root.current,
          start: "top 112px",
          end: "bottom bottom",
          pin: heading,
          pinSpacing: false,
        });
      });

      return () => mediaQuery.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
