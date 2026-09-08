CREATE TABLE "compliance_calendar_items" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"regulatory_document_id" text NOT NULL,
	"applicability_result_id" text NOT NULL,
	"verified_version_id" integer NOT NULL,
	"evidence_id" integer NOT NULL,
	"authority" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"obligation_title" text NOT NULL,
	"description" text NOT NULL,
	"effective_date" date,
	"due_date" date NOT NULL,
	"recurrence_rule" text,
	"deadline_basis" text DEFAULT 'explicit-official-date' NOT NULL,
	"applicability_basis" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"official_source_url" text NOT NULL,
	"last_verified_at" timestamp with time zone NOT NULL,
	"evidence_status" text NOT NULL,
	"calendar_status" text DEFAULT 'active' NOT NULL,
	"completion_state" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compliance_calendar_items" ADD CONSTRAINT "compliance_calendar_items_profile_id_company_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."company_profiles"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compliance_calendar_items" ADD CONSTRAINT "compliance_calendar_items_regulatory_document_id_regulatory_documents_id_fk" FOREIGN KEY ("regulatory_document_id") REFERENCES "public"."regulatory_documents"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compliance_calendar_items" ADD CONSTRAINT "compliance_calendar_items_applicability_result_id_applicability_results_id_fk" FOREIGN KEY ("applicability_result_id") REFERENCES "public"."applicability_results"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compliance_calendar_items" ADD CONSTRAINT "compliance_calendar_items_verified_version_id_regulatory_versions_id_fk" FOREIGN KEY ("verified_version_id") REFERENCES "public"."regulatory_versions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "compliance_calendar_items" ADD CONSTRAINT "compliance_calendar_items_evidence_id_regulatory_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."regulatory_evidence"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "compliance_calendar_items_profile_due_idx" ON "compliance_calendar_items" USING btree ("profile_id","due_date");
--> statement-breakpoint
CREATE INDEX "compliance_calendar_items_document_idx" ON "compliance_calendar_items" USING btree ("regulatory_document_id");
