// Layout chrome: cutoff clock, top nav, sticky cart bar, bottom tabs.

function CutoffClock({ days = "2", hours = "14", zone = "Zone 3" }) {
  return (
    <div style={{
      background: "var(--bg-tinted)", padding: "6px 16px",
      fontSize: 12, color: "var(--ink-primary)", borderBottom: "1px solid var(--border-hairline)",
      fontFamily: "var(--font-sans)", display: "flex", justifyContent: "center", gap: 16,
    }}>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        Next cutoff: <strong>Tue 2:00 pm</strong> · {days}d {hours}h
      </span>
      <span style={{ color: "var(--ink-secondary)" }}>{zone}</span>
    </div>
  );
}

function StoreNav({ active = "guide", cartCount = 0, onNav, onCart }) {
  const links = [
    { id: "guide", label: "My guide" },
    { id: "catalog", label: "Catalog" },
    { id: "standing", label: "Standing" },
    { id: "orders", label: "Orders" },
    { id: "messages", label: "Messages" },
  ];
  return (
    <div style={{
      background: "white", borderBottom: "1px solid var(--border-hairline)",
      padding: "12px 24px", display: "flex", alignItems: "center", gap: 24,
      fontFamily: "var(--font-sans)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BrandLogo size={36}/>
        <Wordmark size={17}/>
      </div>
      <nav style={{ display: "flex", gap: 4, flex: 1 }}>
        {links.map((l) => (
          <button key={l.id} onClick={() => onNav?.(l.id)} style={{
            background: active === l.id ? "var(--bg-secondary)" : "transparent",
            color: active === l.id ? "var(--ink-primary)" : "var(--ink-secondary)",
            border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer",
            fontSize: 14, fontWeight: active === l.id ? 600 : 500,
            fontFamily: "var(--font-sans)",
          }}>{l.label}</button>
        ))}
      </nav>
      <button onClick={onCart} style={{
        display: "flex", alignItems: "center", gap: 6, background: "transparent",
        border: "1px solid rgba(0,0,0,0.10)", borderRadius: 8, padding: "8px 14px", cursor: "pointer",
        fontSize: 14, fontFamily: "var(--font-sans)",
      }}>
        <Icon name="shopping-cart" size={16}/>
        <span>Cart</span>
        {cartCount > 0 ? (
          <span style={{
            background: "var(--brand-green)", color: "#fff", borderRadius: 999,
            fontSize: 11, padding: "1px 7px", fontWeight: 700, fontVariantNumeric: "tabular-nums",
          }}>{cartCount}</span>
        ) : null}
      </button>
    </div>
  );
}

function StickyCartBar({ count, total, onView }) {
  if (!count) return null;
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, bottom: 0,
      background: "white", borderTop: "1px solid var(--border-hairline)",
      boxShadow: "var(--shadow-sticky)", padding: "12px 24px",
      display: "flex", alignItems: "center", gap: 14, fontFamily: "var(--font-sans)",
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: "var(--ink-secondary)" }}>{count} {count === 1 ? "item" : "items"} · Tue delivery</div>
        <div className="tabular" style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>${total.toFixed(2)}</div>
      </div>
      <Button variant="primary" size="md" onClick={onView}>View cart</Button>
    </div>
  );
}

Object.assign(window, { CutoffClock, StoreNav, StickyCartBar });
