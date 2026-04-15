import { createClient } from "@/lib/supabase/server";
import type { QBSetting, DeliveryZoneRow, PickupLocation } from "@/lib/supabase/types";
import { QBSettingsForm } from "./QBSettingsForm";
import { ZoneList } from "./ZoneList";

export const metadata = { title: "Admin — Settings" };

export default async function SettingsPage() {
  const db = await createClient();
  const [{ data: settings }, { data: zones }, { data: pickups }] = await Promise.all([
    db.from("qb_settings").select("*").order("key"),
    db.from("delivery_zones").select("*").order("zone"),
    db.from("pickup_locations").select("*").order("sort_order"),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl">Settings</h1>

      <section>
        <h2 className="font-serif text-xl mb-2">QuickBooks mapping</h2>
        <QBSettingsForm settings={(settings as QBSetting[] | null) ?? []} />
      </section>

      <section>
        <h2 className="font-serif text-xl mb-2">Delivery zones</h2>
        <ZoneList zones={(zones as DeliveryZoneRow[] | null) ?? []} />
      </section>

      <section>
        <h2 className="font-serif text-xl mb-2">Pickup locations</h2>
        <div className="card divide-y divide-black/5">
          {((pickups as PickupLocation[] | null) ?? []).map((p) => (
            <div key={p.id} className="p-3 text-sm">
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-ink-secondary">
                {p.address ?? ""} · {p.pickup_days.join(", ")} · {p.pickup_window ?? ""}
                {!p.active ? <span className="ml-2 badge-gray">off</span> : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
