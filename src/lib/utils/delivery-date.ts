/**
 * Submit-time validation for the buyer's chosen delivery date.
 *
 * The cart store can hold a delivery date that was valid when picked
 * but is no longer orderable — the buyer left the tab open overnight,
 * came back after the cutoff for that day rolled, and the cart still
 * holds yesterday's choice.
 *
 * The fix used to be "is the chosen date inside the server's upcoming-
 * deliveries list?" That broke the moment the cart picker (12 dates)
 * and the guide picker (4 dates) drifted, because a perfectly valid
 * future date past the 4-date guide window came back as "stale" on the
 * SubmitSheet (the false-negative buyer report behind audit Bug A).
 *
 * Real test: is the chosen date strictly EARLIER than the earliest
 * still-orderable delivery the server returned? Anything at-or-after
 * is fine. Plain string compare is safe — both sides are YYYY-MM-DD
 * prefixes so lexicographic order matches calendar order.
 *
 * Returns false (not stale) when either input is missing — callers
 * should treat "no chosen date" as a separate validation step.
 */
export function isDeliveryDateStale(
  chosenDate: string | null | undefined,
  earliestUpcomingDate: string | null | undefined,
): boolean {
  if (!chosenDate || !earliestUpcomingDate) return false;
  const chosenPrefix = datePrefix(chosenDate);
  const earliestPrefix = datePrefix(earliestUpcomingDate);
  if (!chosenPrefix || !earliestPrefix) return false;
  return chosenPrefix < earliestPrefix;
}

/** Pull the YYYY-MM-DD calendar-date prefix from either form. */
function datePrefix(s: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
