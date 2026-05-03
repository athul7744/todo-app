"use client";

import { useRef, useState, useEffect } from "react";

export function AnimatedWidget({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const [isVisible, setIsVisible] = useState(false);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) return;
    const timer = setTimeout(() => {
      setIsVisible(true);
      hasAnimated.current = true;
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.4s ease-out, transform 0.4s ease-out",
        height: "100%",
      }}
    >
      <div className="h-full transition-[opacity,transform] duration-300 ease-in-out">
        {children}
      </div>
    </div>
  );
}
