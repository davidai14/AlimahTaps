-- Phase 3: track loyalty redemption on the order itself (separate from
-- discount_type/discount_amount, which are staff-applied SC/PWD/promo
-- discounts) so POS can show it broken out on the receipt/order detail.
alter table orders add column loyalty_points_redeemed numeric(12, 2) not null default 0;
alter table orders add column loyalty_discount_amount numeric(12, 2) not null default 0;
