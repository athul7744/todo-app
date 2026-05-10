"use client";

import { useEffect, useState } from "react";

export function useRelativeTimeTick(intervalMs = 30000) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTick((current) => current + 1);
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [intervalMs]);

  return tick;
}