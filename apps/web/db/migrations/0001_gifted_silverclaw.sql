ALTER TABLE "profiles" ADD COLUMN "custom_skills" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "job_title" text;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "company" text;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "job_url" text;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "custom_skills" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "layout_meta" jsonb;