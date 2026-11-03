CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap EXCLUDE USING gist (staff_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&) WHERE (status <> 'cancelled');
