"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "@radix-ui/react-icons";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <button
      className="rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors relative"
      style={{
        // @ts-expect-error - CSS custom property type not recognized by TypeScript
        "--tw-ring-color": "var(--gradient-start)",
        "--tw-ring-offset-color": "var(--background)",
      }}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      <div className="relative w-5 h-5">
        <SunIcon
          className="w-5 h-5 absolute top-0 left-0 text-yellow-300 transition-all duration-500"
          style={{
            transform: isDark
              ? "rotate(0deg) scale(1)"
              : "rotate(90deg) scale(0)",
            opacity: isDark ? 1 : 0,
          }}
        />
        <MoonIcon
          className="w-5 h-5 absolute top-0 left-0 text-gray-700 transition-all duration-500"
          style={{
            transform: !isDark
              ? "rotate(0deg) scale(1)"
              : "rotate(-90deg) scale(0)",
            opacity: !isDark ? 1 : 0,
          }}
        />
      </div>
    </button>
  );
}
