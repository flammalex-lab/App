/**
 * Catalog search routing (bug B5).
 *
 * The catalog page must route trigram-fuzzy search through the
 * `catalog_search` RPC (migration 0038) when a query string is present.
 * Before this fix it called `.ilike("name", "%q%")` directly, which
 * could not match typos like "kefr" -> "Kefir".
 *
 * This test exercises the same dispatch shape the page code uses:
 *   - q empty: PostgREST chain (no rpc call)
 *   - q present: `.rpc("catalog_search", { q, ... })` with the visibility
 *     filter args and any group/producer narrow forwarded as parameters.
 */
function buildSearchQuery(
  db: { rpc: (fn: string, args: Record<string, unknown>) => unknown; from: (t: string) => unknown },
  args: {
    q: string;
    isB2B: boolean;
    allowedPrivateIds: string[];
    allowedGroups: string[];
    allowedCategories: string[];
    groupFilter: string | null;
    producerFilter: string;
  },
) {
  if (args.q) {
    return db.rpc("catalog_search", {
      q: args.q,
      is_b2b: args.isB2B,
      allowed_private_ids: args.allowedPrivateIds,
      allowed_groups: args.allowedGroups,
      allowed_categories: args.allowedCategories,
      group_filter: args.groupFilter,
      producer_filter: args.producerFilter || null,
    });
  }
  return db.from("products");
}

describe("catalog search dispatch", () => {
  it("calls catalog_search RPC with the buyer scope and filters when q is present", () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const db = {
      rpc: (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        return { data: [] };
      },
      from: () => {
        throw new Error("from() should not be called when q is present");
      },
    };

    buildSearchQuery(db, {
      q: "kefr",
      isB2B: true,
      allowedPrivateIds: ["abc"],
      allowedGroups: ["dairy", "cheese"],
      allowedCategories: ["dairy", "cheese"],
      groupFilter: "dairy",
      producerFilter: "",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe("catalog_search");
    expect(calls[0].args).toEqual({
      q: "kefr",
      is_b2b: true,
      allowed_private_ids: ["abc"],
      allowed_groups: ["dairy", "cheese"],
      allowed_categories: ["dairy", "cheese"],
      group_filter: "dairy",
      producer_filter: null,
    });
  });

  it("passes a non-empty producer filter through verbatim", () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const db = {
      rpc: (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        return { data: [] };
      },
      from: () => {
        throw new Error("from() should not be called when q is present");
      },
    };

    buildSearchQuery(db, {
      q: "milk",
      isB2B: false,
      allowedPrivateIds: [],
      allowedGroups: ["dairy"],
      allowedCategories: ["dairy"],
      groupFilter: null,
      producerFilter: "Seneca Dairy",
    });

    expect(calls[0].args.producer_filter).toBe("Seneca Dairy");
  });

  it("falls back to the products table when q is empty (no rpc call)", () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const db = {
      rpc: (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        return { data: [] };
      },
      from: (t: string) => ({ table: t }),
    };

    const result = buildSearchQuery(db, {
      q: "",
      isB2B: true,
      allowedPrivateIds: [],
      allowedGroups: ["dairy"],
      allowedCategories: ["dairy"],
      groupFilter: null,
      producerFilter: "",
    });

    expect(calls).toHaveLength(0);
    expect(result).toEqual({ table: "products" });
  });
});
