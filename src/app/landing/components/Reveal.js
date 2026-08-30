"use client";
import { useEffect, useRef } from "react";

/**
 * Reveal-on-scroll. One IntersectionObserver per element, disconnected after
 * the first hit — no scroll listener, no animation library.
 *
 * The shown flag is written straight to the DOM rather than held in state: it
 * is a one-way visual latch that never feeds back into rendering, so a state
 * round-trip would only cost an extra render per element. Honours
 * prefers-reduced-motion by revealing immediately.
 */
export default function Reveal({ as: Tag = "div", delay = 0, className = "", children, ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => el.setAttribute("data-shown", "true");

    if (typeof IntersectionObserver === "undefined"
      || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      show();
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { show(); io.disconnect(); }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`lp-reveal ${className}`.trim()}
      data-shown="false"
      style={delay ? { "--lp-delay": `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
