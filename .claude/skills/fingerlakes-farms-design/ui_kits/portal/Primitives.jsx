// Primitives for the FLF portal UI kit.
// All exports go to window.* at bottom so other Babel scripts can use them.

function Button({ variant = "primary", size = "md", children, onClick, disabled, className = "", ...rest }) {
  const variants = {
    primary:   { bg: "var(--brand-blue)",        color: "#fff", hover: "var(--brand-blue-dark)" },
    success:   { bg: "var(--brand-green)",       color: "#fff", hover: "var(--brand-green-dark)" },
    secondary: { bg: "var(--bg-secondary)",      color: "var(--ink-primary)", hover: "#e6e2d5" },
    ghost:     { bg: "transparent",              color: "var(--ink-primary)", hover: "var(--bg-secondary)" },
    danger:    { bg: "var(--feedback-error)",    color: "#fff", hover: "#a22a1f" },
  }[variant];
  const sizes = { sm: { padding: "6px 12px", fontSize: 13 }, md: { padding: "10px 18px", fontSize: 14 }, lg: { padding: "14px 22px", fontSize: 16 } }[size];
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onClick} disabled={disabled} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className={className}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        borderRadius: 8, border: "none", cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 500, transition: "background 150ms var(--ease-fluent)",
        background: hover && !disabled ? variants.hover : variants.bg,
        color: variants.color, opacity: disabled ? 0.5 : 1,
        fontFamily: "var(--font-sans)", ...sizes, ...rest.style,
      }}>
      {children}
    </button>
  );
}

function Badge({ tone = "gray", children }) {
  const tones = {
    blue:  { bg: "rgba(23,99,181,0.10)",   color: "var(--brand-blue)" },
    green: { bg: "rgba(42,155,70,0.15)",   color: "var(--brand-green-dark)" },
    gold:  { bg: "rgba(196,148,49,0.15)",  color: "#8a690f" },
    red:   { bg: "rgba(193,58,40,0.10)",   color: "var(--feedback-error)" },
    gray:  { bg: "rgba(0,0,0,0.05)",       color: "var(--ink-secondary)" },
  }[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", borderRadius: 9999,
      padding: "3px 10px", fontSize: 12, fontWeight: 500,
      background: tones.bg, color: tones.color, fontFamily: "var(--font-sans)",
    }}>{children}</span>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-primary)" }}>{label}</label>
      {children}
      {hint ? <span style={{ fontSize: 12, color: "var(--ink-secondary)" }}>{hint}</span> : null}
    </div>
  );
}

function Input({ style, ...rest }) {
  return <input {...rest} style={{
    width: "100%", borderRadius: 8, border: "1px solid rgba(0,0,0,0.10)",
    padding: "10px 12px", outline: "none", fontSize: 14, boxSizing: "border-box",
    fontFamily: "var(--font-sans)", transition: "border-color 150ms var(--ease-fluent)",
    ...style,
  }}/>;
}

function QtyInput({ value, onSet }) {
  const [local, setLocal] = React.useState(String(value));
  React.useEffect(() => { setLocal(String(value)); }, [value]);
  function commit() {
    const n = Math.max(0, Math.min(9999, parseInt(local || "0", 10) || 0));
    onSet(n); setLocal(String(n));
  }
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button onClick={() => onSet(Math.max(0, value - 1))} style={qtyBtn}>−</button>
      <input value={local} onChange={(e) => setLocal(e.target.value.replace(/[^\d]/g, "").slice(0, 4))}
        onBlur={commit} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        inputMode="numeric"
        style={{ width: 44, height: 36, textAlign: "center", fontWeight: 600,
                 border: "1px solid rgba(0,0,0,0.15)", borderRadius: 8, fontFamily: "var(--font-sans)",
                 fontVariantNumeric: "tabular-nums" }}/>
      <button onClick={() => onSet(value + 1)} style={qtyBtn}>+</button>
    </div>
  );
}
const qtyBtn = { width: 36, height: 36, borderRadius: 8, border: "1px solid rgba(0,0,0,0.10)", background: "#fff", cursor: "pointer", fontSize: 16, fontFamily: "var(--font-sans)" };

function Card({ children, style, hover = true }) {
  const [hov, setHov] = React.useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: "white", borderRadius: 12,
        border: `1px solid ${hover && hov ? "rgba(0,0,0,0.16)" : "rgba(0,0,0,0.08)"}`,
        transition: "border-color 150ms var(--ease-fluent)", ...style,
      }}>
      {children}
    </div>
  );
}

function BrandLogo({ size = 36 }) {
  return <img src="../../assets/flf-logo.png" width={size} height={size} alt="Fingerlakes Farms"
              style={{ borderRadius: "50%", display: "block" }}/>;
}

function Wordmark({ size = 18 }) {
  return <span style={{
    fontFamily: "var(--font-display)", fontWeight: 800,
    color: "var(--brand-blue)", letterSpacing: "-0.025em",
    fontSize: size, lineHeight: 1,
  }}>Fingerlakes Farms</span>;
}

function Icon({ name, size = 20, color = "currentColor" }) {
  // Lucide icon via global instance; falls back to text glyph
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (window.lucide && ref.current) {
      ref.current.innerHTML = "";
      const i = document.createElement("i");
      i.setAttribute("data-lucide", name);
      ref.current.appendChild(i);
      window.lucide.createIcons({ attrs: { width: size, height: size, "stroke-width": 1.75, color } });
    }
  }, [name, size, color]);
  return <span ref={ref} style={{ display: "inline-flex", width: size, height: size }} />;
}

Object.assign(window, { Button, Badge, Field, Input, QtyInput, Card, BrandLogo, Wordmark, Icon });
