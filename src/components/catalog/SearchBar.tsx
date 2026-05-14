"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

// The BarcodeScanner pulls in @zxing/browser + @zxing/library (~150KB)
// plus a 370-line camera UI. Lazy-load via next/dynamic with ssr:false
// so the closed-state render is a no-op while the chunk downloads on
// first open.
const BarcodeScanner = dynamic(
  () => import("@/components/BarcodeScanner").then((m) => m.BarcodeScanner),
  { ssr: false },
);

const DEBOUNCE_MS = 250;

type UrlMode = {
  mode?: "url";
  /** Default value the input renders with on mount (URL `q` value from
   *  the server render). Subsequent URL changes are mirrored in. */
  defaultValue?: string;
  /** Name of the URL search param the input writes to. Defaults to `q`. */
  paramName?: string;
};

type LocalMode = {
  mode: "local";
  /** Current value (controlled). */
  value: string;
  /** Callback fired on every keystroke. */
  onChange: (next: string) => void;
};

type Props = (UrlMode | LocalMode) & {
  /** Placeholder copy. The component picks a sensible default for each
   *  mode so callers can leave this blank. */
  placeholder?: string;
  /** Optional `<datalist>` id to bind for browser-native autocomplete
   *  (URL-mode only — local mode is filter-as-you-type so it doesn't
   *  need server-side suggestions). */
  datalistId?: string;
  /** When provided, rendered inline below the input — used for "N results"
   *  meta or filter-summary copy. */
  meta?: ReactNode;
  /** Optional className appended to the outer wrapper. */
  className?: string;
  /** Hide the barcode scanner button — used in the guide where the
   *  scanner already exists elsewhere on the page and a second entry
   *  point would be redundant. */
  hideScanner?: boolean;
};

/**
 * Editorial search input. Pretty + functional rewrite of the earlier
 * inline `CatalogSearchInput` — the buyer feedback was "make the search
 * function prettier and maybe more functional, and present in more
 * screens (catalog, category, subcategory, producer, guide)."
 *
 * Visual:
 *   - Rounded-full pill, hairline border, soft focus shadow.
 *   - Magnifying-glass icon left, clear (×) button right when non-empty.
 *   - Scanner button right of clear (catalog only).
 *   - In-flight spinner sits on top of the magnifying glass during a
 *     pending URL transition so the buyer knows the server is querying.
 *
 * Behaviour:
 *   - URL mode (catalog): debounced router.replace into `?q=`, preserves
 *     other params. Mirrors back-button URL changes into local state.
 *   - Local mode (guide): controlled — caller owns the value + filter.
 *   - Keyboard: `/` focuses (skipped if user is already typing in another
 *     input). `Escape` clears + blurs.
 *
 * The component owns no sticky/scroll behaviour itself — callers wrap it
 * in a sticky container (see catalog/layout.tsx) so the same component
 * is reusable in non-sticky contexts (e.g. inline-in-page).
 */
export function SearchBar(props: Props) {
  const isUrl = props.mode !== "local";

  return isUrl ? (
    <UrlSearchBar {...(props as UrlMode & Omit<Props, "mode">)} />
  ) : (
    <LocalSearchBar {...(props as LocalMode & Omit<Props, "mode">)} />
  );
}

// =============================================================================
// URL mode — catalog, category, subcategory, producer
// =============================================================================
function UrlSearchBar({
  defaultValue = "",
  paramName = "q",
  placeholder = "Search products or farms",
  datalistId,
  meta,
  className,
  hideScanner,
}: UrlMode & Omit<Props, "mode">) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const didMount = useRef(false);

  // Mirror URL `q` changes that came from outside this input (back/
  // forward, chip click, navigation from another page) into local
  // state. Render-time set rather than an effect — matches React 19's
  // "adjust state on a prop change" pattern.
  const urlQ = searchParams?.get(paramName) ?? "";
  const [lastUrlQ, setLastUrlQ] = useState(urlQ);
  if (urlQ !== lastUrlQ) {
    setLastUrlQ(urlQ);
    setValue(urlQ);
  }

  // Debounced URL push on typing.
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const urlQNow = searchParams?.get(paramName) ?? "";
    const trimmed = value.trim();
    if (urlQNow === trimmed) return;
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (trimmed) params.set(paramName, trimmed);
      else params.delete(paramName);
      const qs = params.toString();
      const target = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => router.replace(target, { scroll: false }));
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
    // searchParams / pathname / paramName / router are read inside but
    // re-running the timer only on `value` change is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useKeyboardShortcuts(inputRef, () => setValue(""));

  return (
    <>
      <SearchShell
        inputRef={inputRef}
        value={value}
        onChange={setValue}
        placeholder={placeholder}
        datalistId={datalistId}
        isPending={isPending}
        onClear={() => setValue("")}
        onScannerOpen={hideScanner ? undefined : () => setScannerOpen(true)}
        name={paramName}
        meta={meta}
        className={className}
      />
      {!hideScanner ? (
        <BarcodeScanner
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          mode="cart"
        />
      ) : null}
    </>
  );
}

// =============================================================================
// Local mode — guide (filters in-memory rows)
// =============================================================================
function LocalSearchBar({
  value,
  onChange,
  placeholder = "Search your guide",
  meta,
  className,
  hideScanner,
}: LocalMode & Omit<Props, "mode">) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useKeyboardShortcuts(inputRef, () => onChange(""));

  return (
    <>
      <SearchShell
        inputRef={inputRef}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        isPending={false}
        onClear={() => onChange("")}
        onScannerOpen={hideScanner ? undefined : () => setScannerOpen(true)}
        meta={meta}
        className={className}
      />
      {!hideScanner ? (
        <BarcodeScanner
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          mode="cart"
        />
      ) : null}
    </>
  );
}

// =============================================================================
// Shared visual shell — pill input with icon, clear, optional scanner
// =============================================================================
interface ShellProps {
  inputRef: React.RefObject<HTMLInputElement>;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  isPending: boolean;
  onClear: () => void;
  onScannerOpen?: () => void;
  name?: string;
  datalistId?: string;
  meta?: ReactNode;
  className?: string;
}

function SearchShell({
  inputRef,
  value,
  onChange,
  placeholder,
  isPending,
  onClear,
  onScannerOpen,
  name,
  datalistId,
  meta,
  className,
}: ShellProps) {
  const hasValue = value.length > 0;
  return (
    <div className={className ?? ""}>
      <div
        className={`relative flex items-center w-full rounded-full bg-white border transition-all duration-150 ${
          isPending
            ? "border-brand-blue/30 shadow-[0_0_0_3px_rgba(23,99,181,0.08)]"
            : "border-black/10 focus-within:border-brand-blue focus-within:shadow-[0_0_0_3px_rgba(23,99,181,0.12)]"
        }`}
      >
        {/* Left icon — magnifier when idle, tiny spinner overlay when a
            URL transition is in flight. Both share the same slot so the
            input padding stays stable. */}
        <span
          aria-hidden
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-tertiary pointer-events-none"
        >
          {isPending ? (
            <span className="block h-4 w-4 rounded-full border-2 border-brand-blue/30 border-t-brand-blue animate-spin" />
          ) : (
            <SearchIcon />
          )}
        </span>

        <input
          ref={inputRef}
          type="search"
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          // pl-10 leaves room for the left icon; pr varies depending on
          // whether the clear + scanner buttons are visible.
          className={`flex-1 bg-transparent rounded-full pl-10 ${
            onScannerOpen ? (hasValue ? "pr-20" : "pr-12") : hasValue ? "pr-10" : "pr-4"
          } py-2.5 text-[15px] outline-none placeholder:text-ink-tertiary`}
          list={datalistId}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          // type=search renders the native clear x on some browsers; our
          // own is always visible, so we hide the native one to avoid
          // double-x. Safe to leave on for unsupported browsers.
          style={{ WebkitAppearance: "none" }}
        />

        {hasValue ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onClear();
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className={`absolute ${onScannerOpen ? "right-11" : "right-2"} top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-full text-ink-tertiary hover:text-ink-primary hover:bg-bg-secondary transition`}
          >
            <ClearIcon />
          </button>
        ) : null}

        {onScannerOpen ? (
          <button
            type="button"
            onClick={onScannerOpen}
            aria-label="Scan a barcode"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center rounded-full text-ink-secondary hover:text-ink-primary hover:bg-bg-secondary transition"
          >
            <ScanIcon />
          </button>
        ) : null}
      </div>
      {meta ? (
        <div className="mt-1 px-3 text-[11px] text-ink-tertiary">{meta}</div>
      ) : null}
    </div>
  );
}

// =============================================================================
// Keyboard shortcuts — `/` to focus (GitHub-style), `Escape` to clear
// =============================================================================
function useKeyboardShortcuts(
  inputRef: React.RefObject<HTMLInputElement>,
  onClear: () => void,
) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Focus on `/` from anywhere on the page — skip if the buyer is
      // already typing in an input/textarea/contenteditable so the
      // shortcut never eats characters.
      if (e.key === "/" && !isTypingTarget(e.target)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      // Escape clears + blurs only when the input itself has focus.
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        e.preventDefault();
        onClear();
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inputRef, onClear]);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

// =============================================================================
// Icons
// =============================================================================
function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7V5a1 1 0 0 1 1-1h2" />
      <path d="M17 4h2a1 1 0 0 1 1 1v2" />
      <path d="M20 17v2a1 1 0 0 1-1 1h-2" />
      <path d="M7 20H5a1 1 0 0 1-1-1v-2" />
      <path d="M7 9v6M11 9v6M15 9v6" />
    </svg>
  );
}
