import { useEffect, useState } from "react";

interface FlagProps {
  region?: string | null;
  size?: number;
}

const REGIONAL_INDICATOR_MIN = 0x1f1e6; // 🇦
const REGIONAL_INDICATOR_MAX = 0x1f1ff; // 🇿
const ASCII_ALPHA_START = 0x41; // A

const SPECIAL_FLAG_CODE_BY_EMOJI: Record<string, string> = {
  "🇺🇳": "UN",
  "🌐": "UN",
};

function getCountryCodeFromFlagEmoji(input: string): string | null {
  const chars = Array.from(input);
  if (chars.length !== 2) return null;

  const first = chars[0].codePointAt(0) ?? 0;
  const second = chars[1].codePointAt(0) ?? 0;
  const isRegionalIndicator =
    first >= REGIONAL_INDICATOR_MIN &&
    first <= REGIONAL_INDICATOR_MAX &&
    second >= REGIONAL_INDICATOR_MIN &&
    second <= REGIONAL_INDICATOR_MAX;

  if (!isRegionalIndicator) return null;

  return String.fromCodePoint(
    first - REGIONAL_INDICATOR_MIN + ASCII_ALPHA_START,
    second - REGIONAL_INDICATOR_MIN + ASCII_ALPHA_START,
  );
}

function resolveFlagCode(region: string): string | null {
  const countryCodeFromEmoji = getCountryCodeFromFlagEmoji(region);
  if (countryCodeFromEmoji) return countryCodeFromEmoji;

  if (/^[a-zA-Z]{2}$/.test(region)) return region.toUpperCase();

  return SPECIAL_FLAG_CODE_BY_EMOJI[region] ?? null;
}

export function Flag({ region, size = 14 }: FlagProps) {
  const value = region?.trim() ?? "";
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [value]);

  if (!value) {
    return (
      <span
        aria-hidden
        className="inline-block rounded-[3px] shrink-0"
        style={{
          width: size + 8,
          height: size,
          background: "var(--border-subtle)",
        }}
      />
    );
  }

  const flagCode = resolveFlagCode(value) ?? "UN";
  const src = `/assets/flags/${flagCode}.svg`;
  const alt = `地区旗帜: ${flagCode}`;

  if (loadFailed) {
    return (
      <span
        aria-hidden
        className="inline-block rounded-[3px] shrink-0"
        title={alt}
        style={{
          width: size + 8,
          height: size,
          background: "var(--border-subtle)",
        }}
      />
    );
  }

  return (
    <span
      className="inline-flex items-center shrink-0"
      aria-label={alt}
      style={{
        width: size + 8,
        height: size,
        lineHeight: 0,
      }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
        }}
        onError={() => setLoadFailed(true)}
      />
    </span>
  );
}
