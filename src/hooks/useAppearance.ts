import { useEffect } from "react";
import { usePreferences } from "@/hooks/usePreferences";

export function useAppearance() {
  const { resolvedAppearance } = usePreferences();

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.appearance = resolvedAppearance;
    root.style.colorScheme = resolvedAppearance;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) {
      meta.content = resolvedAppearance === "dark" ? "#000000" : "#F5F5F7";
    }
  }, [resolvedAppearance]);
}
