-- Remove leftover E2E test data from rounds 3 + 5.
--
-- These rows were created by smoke-test runs against the live database and
-- never cleaned up. They clutter /admin/standing and /admin/orders for ops,
-- and the sacrificial standing order in particular shows up on the buyer's
-- /standing list as a phantom recurring order.
--
-- The DELETEs on standing_order_items and order_items are technically
-- redundant — both tables ON DELETE CASCADE from their parents — but listed
-- explicitly so the intent is readable and a future schema change to RESTRICT
-- wouldn't silently break this migration.
--
-- notifications and messages reference orders via ON DELETE SET NULL, so they
-- DO need to be cleared explicitly; otherwise they'd just be orphaned with a
-- null related_order_id.
--
-- Idempotent: DELETE WHERE id IN (...) is a no-op once the rows are gone.

-- Sacrificial standing order from the round-5 E2E test
delete from standing_order_items where standing_order_id = '42fa8a2c-fb66-4c64-b007-64176e1e6a25';
delete from standing_orders where id = '42fa8a2c-fb66-4c64-b007-64176e1e6a25';

-- Sacrificial orders (rounds 3 + 5)
delete from notifications where related_order_id in (
  '70492576-6e74-4a80-b66f-9474e626057e',
  '474bcda5-44e5-4e37-884a-2ee25d744485',
  '2b1bcc38-4a76-44a0-b380-8f87f799da92'
);
delete from messages where related_order_id in (
  '70492576-6e74-4a80-b66f-9474e626057e',
  '474bcda5-44e5-4e37-884a-2ee25d744485',
  '2b1bcc38-4a76-44a0-b380-8f87f799da92'
);
delete from order_items where order_id in (
  '70492576-6e74-4a80-b66f-9474e626057e',
  '474bcda5-44e5-4e37-884a-2ee25d744485',
  '2b1bcc38-4a76-44a0-b380-8f87f799da92'
);
delete from orders where id in (
  '70492576-6e74-4a80-b66f-9474e626057e',
  '474bcda5-44e5-4e37-884a-2ee25d744485',
  '2b1bcc38-4a76-44a0-b380-8f87f799da92'
);
