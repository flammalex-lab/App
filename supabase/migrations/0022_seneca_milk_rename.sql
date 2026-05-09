-- Rename the Seneca dairy line to drop "Holstein" from both the producer
-- text and the product names. Brings it in line with the Ithaca pattern
-- post-0021: producer "Seneca Milk", names like "Seneca Whole Milk —
-- Gallon" / "Seneca Skim Milk — Half Gallon".
--
-- Holstein is the cow breed, which a buyer doesn't need in the SKU label;
-- "Seneca Milk" reads consistently next to "Ithaca Milk" in the producer
-- chip and the name itself stays specific via the fat-content adjective.
--
-- Idempotent: updates are gated on the old text still being present, so
-- re-running this migration is a no-op once it's been applied.

-- 1. Producer field.
update products
   set producer = 'Seneca Milk'
 where producer = 'Seneca Holstein';

-- 2. Product names. Strip "Holstein " from anywhere "Seneca Holstein "
--    appears as a prefix; the rest of the name (variant + " — Pack") is
--    preserved.
update products
   set name = regexp_replace(name, '^Seneca Holstein\s', 'Seneca ')
 where name ~ '^Seneca Holstein\s';
