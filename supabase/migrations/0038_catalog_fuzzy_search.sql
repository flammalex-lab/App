-- 0038: fuzzy catalog search via pg_trgm similarity.
--
-- Migration 0036 added GIN trigram indexes on products.name and
-- products.producer, but the catalog page in src/app/(storefront)/
-- catalog/page.tsx was still doing `name ilike '%q%' or producer ilike
-- '%q%'`. That's substring search — it can't find typos. "kefr" misses
-- "Kefir" entirely, and "yogert" misses "Yogurt".
--
-- This RPC uses the trigram `%` operator (set_limit-controlled) and
-- ranks results by similarity. The visibility filters mirror
-- visibleProductsQuery() in src/lib/products/queries.ts exactly:
--   * is_active = true
--   * available_b2b / available_dtc based on the buyer's channel
--   * private = false UNLESS the caller passes its allow-list of IDs
--   * product_group / category scoped by the caller-provided arrays
--   * optional group filter (matches primary product_group OR an entry
--     in additional_groups, same as the page's `groupFilter` clause)
--   * optional producer filter (exact, case-insensitive)
--
-- Threshold: 0.20 minimum via set_limit() for the `%` operator, with a
-- second pass requiring similarity > 0.25 in the WHERE so we don't
-- surface very-weak matches. Matches against name OR producer; greatest()
-- picks the stronger of the two for ranking.

create extension if not exists pg_trgm;

create or replace function public.catalog_search(
  q text,
  is_b2b boolean,
  allowed_private_ids uuid[],
  allowed_groups text[],
  allowed_categories text[],
  group_filter text default null,
  producer_filter text default null
)
returns setof products
language plpgsql
security invoker
set search_path = public
stable
as $$
begin
  -- Loosen the trigram operator's threshold a bit so common 1-letter
  -- typos still index-hit. We still re-check with similarity() below.
  perform set_limit(0.20);

  return query
  select p.*
  from products p
  where
    p.is_active = true
    and (case when is_b2b then p.available_b2b else p.available_dtc end) = true
    and (
      p.private = false
      or (allowed_private_ids is not null and p.id = any(allowed_private_ids))
    )
    and (
      (allowed_groups is null or array_length(allowed_groups, 1) is null
        or p.product_group::text = any(allowed_groups))
      or
      (allowed_categories is null or array_length(allowed_categories, 1) is null
        or p.category::text = any(allowed_categories))
    )
    and (
      group_filter is null
      or p.product_group::text = group_filter
      or (p.additional_groups is not null and group_filter = any(p.additional_groups::text[]))
    )
    and (
      producer_filter is null
      or lower(p.producer) = lower(producer_filter)
    )
    and (
      p.name % q
      or coalesce(p.producer, '') % q
    )
    and greatest(
      similarity(p.name, q),
      similarity(coalesce(p.producer, ''), q)
    ) > 0.25
  order by
    greatest(similarity(p.name, q), similarity(coalesce(p.producer, ''), q)) desc,
    p.name asc
  limit 100;
end;
$$;

grant execute on function public.catalog_search(
  text, boolean, uuid[], text[], text[], text, text
) to authenticated;
