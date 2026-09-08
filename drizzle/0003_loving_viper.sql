CREATE TABLE "regulatory_deadline_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"regulatory_document_id" text NOT NULL,
	"verified_version_id" integer NOT NULL,
	"evidence_id" integer NOT NULL,
	"obligation_title" text NOT NULL,
	"description" text NOT NULL,
	"effective_date" date,
	"due_date" date NOT NULL,
	"recurrence_rule" text,
	"deadline_basis" text DEFAULT 'explicit-official-date' NOT NULL,
	"authority" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"official_source_url" text NOT NULL,
	"evidence_status" text NOT NULL,
	"last_verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compliance_calendar_items" ADD COLUMN "deadline_definition_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "regulatory_deadline_definitions" ADD CONSTRAINT "regulatory_deadline_definitions_regulatory_document_id_regulatory_documents_id_fk" FOREIGN KEY ("regulatory_document_id") REFERENCES "public"."regulatory_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_deadline_definitions" ADD CONSTRAINT "regulatory_deadline_definitions_verified_version_id_regulatory_versions_id_fk" FOREIGN KEY ("verified_version_id") REFERENCES "public"."regulatory_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_deadline_definitions" ADD CONSTRAINT "regulatory_deadline_definitions_evidence_id_regulatory_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."regulatory_evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "regulatory_deadline_definitions_document_idx" ON "regulatory_deadline_definitions" USING btree ("regulatory_document_id");--> statement-breakpoint
CREATE INDEX "regulatory_deadline_definitions_due_idx" ON "regulatory_deadline_definitions" USING btree ("due_date");--> statement-breakpoint
ALTER TABLE "compliance_calendar_items" ADD CONSTRAINT "compliance_calendar_items_deadline_definition_id_regulatory_deadline_definitions_id_fk" FOREIGN KEY ("deadline_definition_id") REFERENCES "public"."regulatory_deadline_definitions"("id") ON DELETE no action ON UPDATE no action;