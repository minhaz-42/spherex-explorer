import { type CSSProperties, type ElementType, type ReactNode, useRef } from "react";

import { useInView } from "./motion";

/** Content that rises into place the first time it scrolls into view. */
export function Reveal({
  as: Tag = "div",
  delay = 0,
  className = "",
  children,
}: {
  as?: ElementType;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const shown = useInView(ref, { once: true, margin: "-60px" });
  return (
    <Tag
      ref={ref}
      className={`reveal ${shown ? "is-visible" : ""} ${className}`}
      style={{ "--i": delay } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
