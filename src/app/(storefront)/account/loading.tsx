/**
 * Skeleton for /account. Mirrors the real layout so the swap-in is a
 * content-fade, not a reflow: centered avatar header + ~7 sections
 * (Contact, SMS, Notifications, Employees, Support, Sign-in, Account).
 * Pulse on the section list, not the avatar header — the avatar block
 * is the steady visual anchor the buyer's eye lands on first.
 */
export default function AccountLoading() {
  return (
    <div className="max-w-2xl mx-auto pb-12">
      <div className="flex flex-col items-center pt-4 pb-6">
        <div className="h-24 w-24 rounded-full bg-black/8" />
        <div className="h-7 w-40 rounded bg-black/8 mt-3" />
        <div className="h-4 w-28 rounded bg-black/8 mt-2" />
      </div>
      <div className="animate-pulse">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="card p-4 mb-3">
            <div className="h-3 w-20 rounded bg-black/8 mb-3" />
            <div className="space-y-2">
              <div className="h-5 rounded bg-black/8" />
              <div className="h-5 rounded bg-black/8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
