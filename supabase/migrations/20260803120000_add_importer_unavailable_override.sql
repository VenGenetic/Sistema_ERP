-- Migration: Manual "unavailable at importer" override
-- Timestamp: 20260803120000
--
-- Lets staff force a product's importer_stock to read as 0 even when the
-- scraper reports a positive number, for cases where the importer's website
-- claims stock that isn't actually there. The override auto-expires (goes
-- back to trusting the scraped number) once importer_unavailable_until
-- passes and the row is next written to -- which happens naturally on every
-- sync-importer-stock run, so no pg_cron/scheduled job is needed.
--
-- Deliberately does NOT rename or restructure the existing importer_stock
-- column: the untracked `update_importer_stock` RPC (created directly in the
-- dashboard, not present in any migration file) and the sync script's
-- fallback per-row update both write to it directly today, and this keeps
-- both working completely unchanged. Every frontend call site that already
-- reads product.importer_stock (Products, SourcingPipeline, Replenishment,
-- ProductDemands, ProductGroupModal, mobile catalog, etc.) also keeps working
-- with zero changes, since the stored value itself is what gets forced to 0.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS importer_unavailable_override BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS importer_unavailable_until TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Forces importer_stock to 0 whenever the override is active, and clears an
-- expired temporary override on the next write to the row (manual edit,
-- bulk edit, or the next importer stock sync).
CREATE OR REPLACE FUNCTION trg_enforce_importer_unavailable_override()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.importer_unavailable_override AND NEW.importer_unavailable_until IS NOT NULL
       AND NEW.importer_unavailable_until <= TIMEZONE('utc'::text, NOW()) THEN
        NEW.importer_unavailable_override := false;
        NEW.importer_unavailable_until := NULL;
    END IF;

    IF NEW.importer_unavailable_override THEN
        NEW.importer_stock := 0;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Named to sort alphabetically before trg_products_auto_found (BEFORE
-- triggers on the same table/event fire in trigger-name order), so that
-- trigger -- and the AFTER trigger trg_products_stock_arrival below -- always
-- see the already-overridden importer_stock value.
DROP TRIGGER IF EXISTS trg_products_0_importer_override ON public.products;
CREATE TRIGGER trg_products_0_importer_override
BEFORE INSERT OR UPDATE OF importer_stock, importer_unavailable_override, importer_unavailable_until
ON public.products
FOR EACH ROW
EXECUTE FUNCTION trg_enforce_importer_unavailable_override();

-- Widen the existing sourcing-pipeline "stock found" trigger so it also
-- re-evaluates investigation_status when the override is toggled directly
-- (not just when the raw importer_stock number itself changes in the same
-- statement). Function body is unchanged -- by the time it runs,
-- NEW.importer_stock already reflects the forced-to-0 value.
DROP TRIGGER IF EXISTS trg_products_auto_found ON public.products;
CREATE TRIGGER trg_products_auto_found
BEFORE UPDATE OF importer_stock, importer_unavailable_override, importer_unavailable_until
ON public.products
FOR EACH ROW
EXECUTE FUNCTION trg_check_importer_stock_found();

-- Widen + extend the existing demand-arrival trigger: it already flips
-- pending demands to 'stock_available' when stock appears; now it also
-- reverts that back to 'pending_stock' (only if not yet notified) when stock
-- disappears again -- whether from a real stock-out or from this override --
-- so we never leave a false "it's available" promise sitting on a demand.
CREATE OR REPLACE FUNCTION trg_check_demand_stock_arrival()
RETURNS TRIGGER AS $$
BEGIN
    -- Stock appeared: move waiting demands from pending to available.
    IF ((OLD.importer_stock IS NULL OR OLD.importer_stock = 0) AND NEW.importer_stock > 0) OR
       ((OLD.local_stock IS NULL OR OLD.local_stock = 0) AND NEW.local_stock > 0) THEN

        UPDATE public.product_demands
        SET status = 'stock_available',
            stock_detected_at = TIMEZONE('utc'::text, NOW()),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE product_id = NEW.id AND status = 'pending_stock';
    END IF;

    -- Stock disappeared again (real stock-out, or this manual override):
    -- un-promise any demand we'd flagged available but hadn't notified yet.
    IF (OLD.importer_stock > 0 AND (NEW.importer_stock IS NULL OR NEW.importer_stock = 0)) OR
       (OLD.local_stock > 0 AND (NEW.local_stock IS NULL OR NEW.local_stock = 0)) THEN

        UPDATE public.product_demands
        SET status = 'pending_stock',
            stock_detected_at = NULL,
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE product_id = NEW.id AND status = 'stock_available';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_stock_arrival ON public.products;
CREATE TRIGGER trg_products_stock_arrival
AFTER UPDATE OF importer_stock, local_stock, importer_unavailable_override, importer_unavailable_until
ON public.products
FOR EACH ROW
EXECUTE FUNCTION trg_check_demand_stock_arrival();
