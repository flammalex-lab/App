# Loading the real FLF catalog (398 products)

Postgres won't let you add enum values and use them in the same transaction, so
the install is **two queries**. This takes ~30 seconds total.

## Step 1 — add the new product categories

In Terminal:

```bash
cat supabase/migrations/0004_add_categories.sql | pbcopy
```

Then in Supabase SQL Editor: paste → **Run**. Should see `Success. No rows returned.`

## Step 2 — load all 398 products

In Terminal:

```bash
cat supabase/full-catalog-products.sql | pbcopy
```

Then in Supabase SQL Editor: paste → **Run**. Should see `Success. No rows returned.`
This inserts 398 products across beef, pork, lamb, eggs, dairy, produce, pantry,
beverages with real wholesale prices. Safe to re-run — uses `ON CONFLICT DO NOTHING`.

## Step 3 — re-seed the demo data (optional)

If you want Hugh's demo order guide to populate with real SKUs:

```bash
npm run seed:demo flamm.alex@gmail.com
```

## Verify

In the app, visit `/catalog`. You should see 8 category tiles. Click any → list
of real products with real prices.

## If something goes wrong

- **"unsafe use of new value"** → you ran Part 2 before Part 1 committed. Just re-run Part 2; the enum is now committed and it'll succeed.
- **"duplicate key value violates unique constraint"** → data's already there. `ON CONFLICT (sku) DO NOTHING` should prevent this, but if you see it, just ignore — it means this product was already seeded.
- **anything else** → paste the error back to me.
