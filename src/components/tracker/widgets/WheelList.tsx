"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/shared/utils";

interface WheelItem {
  name: string;
  hours: number;
  color: string;
  percentage: number;
}

export function WheelList({ items }: { items: WheelItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const itemHeight = 36;

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.addEventListener("scroll", handleScroll, { passive: true });
      return () => el.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  const containerHeight = containerRef.current?.clientHeight || 200;
  const centerY = scrollTop + containerHeight / 2;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-y-auto px-3 scrollbar-none"
      style={{ scrollbarWidth: "none" }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top/bottom padding to allow first/last items to center */}
      <div style={{ height: containerHeight / 2 - itemHeight / 2 }} />
      {items.map((s, i) => {
        const itemCenter = (containerHeight / 2 - itemHeight / 2) + i * itemHeight + itemHeight / 2;
        const distance = Math.abs(itemCenter - centerY);
        const isCenter = distance < itemHeight / 2;
        const maxDist = containerHeight / 2;
        const normalized = Math.min(distance / maxDist, 1);
        const scale = isCenter ? 1.05 : 1 - normalized * 0.1;
        const opacity = isCenter ? 1 : 1 - normalized * 0.45;

        return (
          <div
            key={s.name}
            className="flex items-center justify-between px-2 rounded-md"
            style={{
              height: itemHeight,
              transform: `scale(${scale})`,
              opacity,
              transition: "transform 0.15s ease-in-out, opacity 0.15s ease-in-out",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className={cn("font-medium text-foreground", isCenter ? "text-base" : "text-sm")}>{s.name}</span>
            </div>
            <span className={cn("text-muted-foreground", isCenter ? "text-base" : "text-sm")}>{s.hours}h · {Math.round(s.percentage)}%</span>
          </div>
        );
      })}
      <div style={{ height: containerHeight / 2 - itemHeight / 2 }} />
    </div>
  );
}
