import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { formatDate, parseExpiry } from "@/lib/date-utils";

interface ExpiryInputProps {
  /** Stored value, YYYY-MM-DD (or "") */
  value: string;
  /** Called with YYYY-MM-DD, or "" while the text is empty/unparseable */
  onChange: (iso: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

/** Day-first date entry: type 27/04/27, 27-04-2027 or 27/Apr/2027. Always stores YYYY-MM-DD. */
export function ExpiryInput({ value, onChange, className, style }: ExpiryInputProps) {
  const [text, setText] = useState(value ? formatDate(value) : "");
  const [invalid, setInvalid] = useState(false);

  // Sync if the parent value changes from outside (e.g. dialog reopened)
  useEffect(() => {
    if (value !== (parseExpiry(text) ?? "")) setText(value ? formatDate(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="text"
      inputMode="text"
      placeholder="DD/Mon/YYYY"
      title="Type day first, e.g. 27/04/2027 or 27/Apr/2027"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const iso = parseExpiry(e.target.value);
        setInvalid(!!e.target.value.trim() && !iso);
        onChange(iso ?? "");
      }}
      onBlur={() => {
        const iso = parseExpiry(text);
        if (iso) setText(formatDate(iso));
      }}
      style={style}
      className={cn(
        "h-8 w-32 rounded-md border border-input bg-background px-2 text-sm",
        invalid && "border-destructive text-destructive",
        className,
      )}
    />
  );
}
