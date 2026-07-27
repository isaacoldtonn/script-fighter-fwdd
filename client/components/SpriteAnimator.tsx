"use client";

import React, { useEffect, useRef, useState } from "react";

interface SpriteAnimatorProps {
  src: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  fps: number;
  loop: boolean;
  playing: boolean;
  scale?: number;
  flipped?: boolean;
  onComplete?: () => void;
  className?: string;
}

export default function SpriteAnimator({
  src,
  frameCount,
  frameWidth,
  frameHeight,
  fps,
  loop,
  playing,
  scale = 2.5,
  flipped = false,
  onComplete,
  className,
}: SpriteAnimatorProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep the latest onComplete in a ref rather than the effect's dependency
  // array — an inline arrow function prop gets a new identity on every parent
  // render, which would otherwise tear down and restart the interval (and
  // lose timing) any time the parent re-renders for an unrelated reason.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const displayW = Math.round(frameWidth * scale);
  const displayH = Math.round(frameHeight * scale);
  const totalW = Math.round(frameWidth * frameCount * scale);

  useEffect(() => {
    if (!playing) {
      setCurrentFrame(0);
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentFrame((prev) => {
        const next = prev + 1;
        if (next >= frameCount) {
          if (loop) return 0;
          if (intervalRef.current) clearInterval(intervalRef.current);
          onCompleteRef.current?.();
          return frameCount - 1; // freeze on last frame
        }
        return next;
      });
    }, 1000 / fps);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, fps, frameCount, loop]);

  const bgX = -(currentFrame * displayW);

  return (
    <div
      className={className}
      style={{
        width: displayW,
        height: displayH,
        backgroundImage: `url(${src})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${totalW}px ${displayH}px`,
        backgroundPosition: `${bgX}px 0px`,
        transform: flipped ? "scaleX(-1)" : "none",
        imageRendering: "pixelated",
      }}
    />
  );
}
