// Screens for the FLF portal UI kit. Each renders inside the laptop frame.

function LoginScreen({ onLogin }) {
  const [step, setStep] = React.useState("phone");
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", height: "100%", fontFamily: "var(--font-sans)" }}>
      <div style={{
        backgroundImage: "url('../../assets/photos/cow-jersey.jpg')",
        backgroundSize: "cover", backgroundPosition: "center",
        position: "relative",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.55) 100%)",
        }}/>
        <div style={{ position: "absolute", bottom: 32, left: 32, color: "white", maxWidth: 420 }}>
          <div className="display" style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.05 }}>
            Trust our process. Trust your food.
          </div>
          <p style={{ marginTop: 12, fontSize: 14, opacity: 0.9, lineHeight: 1.5 }}>
            Local meat, dairy, and produce from vetted Finger Lakes farms — delivered weekly to your kitchen.
          </p>
        </div>
      </div>
      <div style={{ background: "white", display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ width: "100%", maxWidth: 320 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <BrandLogo size={40}/><Wordmark size={18}/>
          </div>
          {step === "phone" ? (
            <>
              <h2 style={{ margin: "0 0 6px" }}>Sign in</h2>
              <p style={{ fontSize: 13, color: "var(--ink-secondary)", margin: "0 0 18px" }}>
                Enter your phone. We'll text a one-time code.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Field label="Phone number">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(607) 555-0182"/>
                </Field>
                <Button variant="primary" size="lg" onClick={() => phone && setStep("code")}>
                  Send code
                </Button>
                <p style={{ fontSize: 12, color: "var(--ink-tertiary)", textAlign: "center", margin: 0 }}>
                  Your rep set up the account. Text Alex if you don't have access yet.
                </p>
              </div>
            </>
          ) : (
            <>
              <h2 style={{ margin: "0 0 6px" }}>Enter code</h2>
              <p style={{ fontSize: 13, color: "var(--ink-secondary)", margin: "0 0 18px" }}>
                Sent to {phone || "your phone"}.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <Field label="6-digit code">
                  <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456" inputMode="numeric"
                    style={{ fontSize: 20, letterSpacing: 4, textAlign: "center", fontVariantNumeric: "tabular-nums" }}/>
                </Field>
                <Button variant="primary" size="lg" onClick={onLogin}>Sign in</Button>
                <button onClick={() => setStep("phone")} style={{
                  background: "transparent", border: "none", color: "var(--brand-blue)",
                  fontSize: 13, cursor: "pointer", padding: 6,
                }}>Use a different number</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const GUIDE_ITEMS = [
  { id: 1, name: "Heirloom tomatoes", sku: "PR-0421", unit: "12 lb case", price: 32.00, par: 6, photo: "produce-1.jpg", brand: "Grasslands" },
  { id: 2, name: "Pasture-raised eggs", sku: "MC-1130", unit: "15 doz flat", price: 78.00, par: 4, photo: "chicken-1.jpg", brand: "Meadow Creek" },
  { id: 3, name: "Jersey whole milk", sku: "DA-0207", unit: "1 gal", price: 9.50, par: 24, photo: "farm-3.jpg", brand: "Fingerlakes" },
  { id: 4, name: "Ground beef · 80/20", sku: "GR-0901", unit: "5 lb", price: 42.00, par: 8, photo: "farm-4.jpg", brand: "Grasslands" },
  { id: 5, name: "Salad greens mix", sku: "PR-0612", unit: "3 lb", price: 24.00, par: 12, photo: "produce-2.jpg", brand: "Grasslands" },
  { id: 6, name: "Salted butter", sku: "DA-0312", unit: "1 lb", price: 7.25, par: 18, photo: "farm-2.jpg", brand: "Fingerlakes" },
];

function GuideScreen({ qty, setQty }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <h1 style={{ margin: 0 }}>My guide</h1>
        <span className="eyebrow">Tue 2pm cutoff · Zone 3</span>
      </div>
      <p style={{ color: "var(--ink-secondary)", fontSize: 14, margin: "4px 0 24px" }}>
        Your saved list with par levels. Adjust qty, place by Tuesday 2pm.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {GUIDE_ITEMS.map((item) => (
          <Card key={item.id} style={{ padding: 14, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 8, flexShrink: 0,
              backgroundImage: `url('../../assets/photos/${item.photo}')`,
              backgroundSize: "cover", backgroundPosition: "center",
            }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{item.name}</span>
                <Badge tone="blue">{item.brand}</Badge>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-secondary)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                {item.unit} · SKU {item.sku} · par {item.par}/wk
              </div>
            </div>
            <div className="tabular" style={{ fontWeight: 700, fontSize: 15, minWidth: 60, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              ${item.price.toFixed(2)}
            </div>
            <QtyInput value={qty[item.id] ?? 0} onSet={(n) => setQty({ ...qty, [item.id]: n })}/>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CartScreen({ qty, setQty, onPlace, onBack }) {
  const items = GUIDE_ITEMS.filter((i) => qty[i.id]);
  const total = items.reduce((s, i) => s + i.price * qty[i.id], 0);
  return (
    <div>
      <button onClick={onBack} style={{
        background: "transparent", border: "none", color: "var(--brand-blue)",
        cursor: "pointer", padding: 0, fontSize: 13, marginBottom: 8, display: "inline-flex", alignItems: "center", gap: 4,
      }}>← Back to guide</button>
      <h1 style={{ margin: "0 0 4px" }}>Cart</h1>
      <p style={{ color: "var(--ink-secondary)", fontSize: 14, margin: "0 0 20px" }}>
        Tuesday delivery · Zone 3. We'll text you a confirmation after the cutoff.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.length === 0 ? (
          <Card style={{ padding: 28, textAlign: "center" }}>
            <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>Your cart is empty</p>
            <p style={{ fontSize: 12, color: "var(--ink-secondary)", marginTop: 4 }}>Add items from your guide.</p>
          </Card>
        ) : items.map((item) => (
          <Card key={item.id} style={{ padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
              <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>{item.unit}</div>
            </div>
            <QtyInput value={qty[item.id]} onSet={(n) => setQty({ ...qty, [item.id]: n })}/>
            <div className="tabular" style={{ fontWeight: 700, fontSize: 14, minWidth: 70, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              ${(item.price * qty[item.id]).toFixed(2)}
            </div>
          </Card>
        ))}
      </div>
      {items.length > 0 ? (
        <div style={{ marginTop: 22, padding: 16, background: "var(--bg-secondary)", borderRadius: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 6 }}>
            <span style={{ color: "var(--ink-secondary)" }}>Subtotal</span>
            <span className="tabular" style={{ fontVariantNumeric: "tabular-nums" }}>${total.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 12 }}>
            <span style={{ color: "var(--ink-secondary)" }}>Delivery</span>
            <span>Included</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, paddingTop: 12, borderTop: "1px solid var(--border-hairline)" }}>
            <span>Total</span>
            <span className="tabular" style={{ fontVariantNumeric: "tabular-nums" }}>${total.toFixed(2)}</span>
          </div>
          <Button variant="success" size="lg" onClick={onPlace} style={{ width: "100%", marginTop: 16 }}>
            Place order · billed via QuickBooks
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ConfirmedScreen({ onBack }) {
  return (
    <div style={{ maxWidth: 440, margin: "60px auto 0", textAlign: "center" }}>
      <div style={{
        width: 56, height: 56, borderRadius: 999, background: "var(--brand-green-tint)",
        display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
      }}>
        <Icon name="check" size={28} color="var(--brand-green-dark)"/>
      </div>
      <h1 style={{ margin: "0 0 6px" }}>Order placed.</h1>
      <p style={{ color: "var(--ink-secondary)", fontSize: 14, margin: 0 }}>
        Delivery <strong>Tue 5/12</strong>, Zone 3. You'll get a text after the 2pm cutoff confirms availability.
      </p>
      <p style={{ color: "var(--ink-secondary)", fontSize: 13, marginTop: 12 }}>
        Invoice sent to your QuickBooks · Net 14.
      </p>
      <div style={{ marginTop: 24 }}>
        <Button variant="secondary" onClick={onBack}>Back to guide</Button>
      </div>
    </div>
  );
}

function MessagesScreen() {
  return (
    <div>
      <h1 style={{ margin: "0 0 4px" }}>Messages</h1>
      <p style={{ color: "var(--ink-secondary)", fontSize: 14, margin: "0 0 20px" }}>
        Threaded with your rep. Replies go to your phone as a text.
      </p>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-hairline)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 999, background: "var(--brand-blue-tint)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "var(--brand-blue)", fontWeight: 700, fontSize: 13 }}>A</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Alex · your rep</div>
            <div style={{ fontSize: 12, color: "var(--ink-secondary)" }}>SMS bridged · usually replies in 10 min</div>
          </div>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, minHeight: 280 }}>
          <Msg from="them">Heirloom toms ship Friday — short by 4 cases this week, OK to substitute beefsteak?</Msg>
          <Msg from="me">Yeah substitute is fine. Same price?</Msg>
          <Msg from="them">Same. We'll mark it on the invoice.</Msg>
          <Msg from="me">Cool. Also can you bump my egg par to 6/wk?</Msg>
          <Msg from="them">Done. Standing order will reflect Friday.</Msg>
        </div>
        <div style={{ padding: 12, borderTop: "1px solid var(--border-hairline)", display: "flex", gap: 8 }}>
          <Input placeholder="Message Alex…" style={{ flex: 1 }}/>
          <Button variant="primary">Send</Button>
        </div>
      </Card>
    </div>
  );
}

function Msg({ from, children }) {
  const me = from === "me";
  return (
    <div style={{ display: "flex", justifyContent: me ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "70%", padding: "8px 12px", borderRadius: 14, fontSize: 13.5,
        background: me ? "var(--brand-blue)" : "var(--bg-secondary)",
        color: me ? "white" : "var(--ink-primary)",
      }}>{children}</div>
    </div>
  );
}

Object.assign(window, { LoginScreen, GuideScreen, CartScreen, ConfirmedScreen, MessagesScreen });
