"use client";

import { useTheme } from "next-themes";
import Image from "next/image";
import { useEffect, useState } from "react";

interface ThemeAwareImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}

export function ThemeAwareImage({
  src,
  alt,
  width,
  height,
  className = "",
  priority = false,
}: ThemeAwareImageProps) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a placeholder or nothing during SSR
    return (
      <div
        style={{ width: `${width}px`, height: `${height}px` }}
        className="bg-transparent"
      />
    );
  }

  const shouldInvert = theme === "light";

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={`${className} ${shouldInvert ? "invert" : ""}`}
      priority={priority}
    />
  );
}
