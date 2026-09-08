CREATE TABLE "regulatory_change_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"regulatory_document_id" text NOT NULL,
	"previous_version_id" integer,
	"current_version_id" integer NOT NULL,
	"current_evidence_id" integer NOT NULL,
	"change_type" text NOT NULL,
	"issued_date" date,
	"effective_date" date,
	"summary" text NOT NULL,
	"affected_obligations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"official_source_url" text NOT NULL,
	"evidence_status" text NOT NULL,
	"last_verified_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "regulatory_change_definitions" ADD CONSTRAINT "regulatory_change_definitions_regulatory_document_id_regulatory_documents_id_fk" FOREIGN KEY ("regulatory_document_id") REFERENCES "public"."regulatory_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_change_definitions" ADD CONSTRAINT "regulatory_change_definitions_previous_version_id_regulatory_versions_id_fk" FOREIGN KEY ("previous_version_id") REFERENCES "public"."regulatory_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_change_definitions" ADD CONSTRAINT "regulatory_change_definitions_current_version_id_regulatory_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."regulatory_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_change_definitions" ADD CONSTRAINT "regulatory_change_definitions_current_evidence_id_regulatory_evidence_id_fk" FOREIGN KEY ("current_evidence_id") REFERENCES "public"."regulatory_evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "regulatory_change_definitions_document_idx" ON "regulatory_change_definitions" USING btree ("regulatory_document_id");--> statement-breakpoint
CREATE INDEX "regulatory_change_definitions_current_version_idx" ON "regulatory_change_definitions" USING btree ("current_version_id");--> statement-breakpoint
CREATE INDEX "regulatory_change_definitions_current_evidence_idx" ON "regulatory_change_definitions" USING btree ("current_evidence_id");--> statement-breakpoint
ALTER TABLE "regulatory_change_alerts" ADD COLUMN "change_definition_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "regulatory_change_alerts" ADD CONSTRAINT "regulatory_change_alerts_change_definition_id_regulatory_change_definitions_id_fk" FOREIGN KEY ("change_definition_id") REFERENCES "public"."regulatory_change_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "regulatory_change_alerts_definition_idx" ON "regulatory_change_alerts" USING btree ("change_definition_id");