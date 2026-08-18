import { useEffect, useRef, useState } from "react";

/**
 * Wraps any element with a staggered entrance animation using IntersectionObserver.
 * Cards animate in as they scroll into view, with an optional delay for stagger effects.
 */
export function AnimatedCard({
  children,
  className = "",
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`anim-card ${visible ? "anim-card--in" : ""} ${className}`}
      style={{ ...style, animationDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

/**
 * Wraps a grid with staggered child card animations.
 * Each direct child gets an increasing delay.
 */
export function StaggerGrid({
  children,
  className = "",
  baseDelay = 0,
  step = 60,
}: {
  children: React.ReactNode;
  className?: string;
  baseDelay?: number;
  step?: number;
}) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div className={className}>
      {items.map((child, i) =>
        child ? (
          <AnimatedCard key={i} delay={baseDelay + i * step}>
            {child}
          </AnimatedCard>
        ) : null,
      )}
    </div>
  );
}
