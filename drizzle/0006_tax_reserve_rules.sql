CREATE TABLE "regulatory_tax_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"regulatory_document_id" text NOT NULL,
	"verified_version_id" integer NOT NULL,
	"evidence_id" integer NOT NULL,
	"tax_type" text NOT NULL,
	"rule_kind" text NOT NULL,
	"rule_label" text NOT NULL,
	"parameters" jsonb NOT NULL,
	"applicable_from" date NOT NULL,
	"applicable_to" date,
	"authority" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"official_source_url" text NOT NULL,
	"evidence_status" text NOT NULL,
	"last_verified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regulatory_tax_rules_tax_type_valid" CHECK ("regulatory_tax_rules"."tax_type" in ('corporate_tax', 'vat')),
	CONSTRAINT "regulatory_tax_rules_kind_valid" CHECK ("regulatory_tax_rules"."rule_kind" in ('progressive-rate-bands', 'net-output-minus-recoverable-input')),
	CONSTRAINT "regulatory_tax_rules_parameters_object" CHECK (jsonb_typeof("regulatory_tax_rules"."parameters") = 'object'),
	CONSTRAINT "regulatory_tax_rules_period_valid" CHECK ("regulatory_tax_rules"."applicable_to" is null or "regulatory_tax_rules"."applicable_to" >= "regulatory_tax_rules"."applicable_from")
);
--> statement-breakpoint
ALTER TABLE "regulatory_tax_rules" ADD CONSTRAINT "regulatory_tax_rules_regulatory_document_id_regulatory_documents_id_fk" FOREIGN KEY ("regulatory_document_id") REFERENCES "public"."regulatory_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_tax_rules" ADD CONSTRAINT "regulatory_tax_rules_verified_version_id_regulatory_versions_id_fk" FOREIGN KEY ("verified_version_id") REFERENCES "public"."regulatory_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_tax_rules" ADD CONSTRAINT "regulatory_tax_rules_evidence_id_regulatory_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."regulatory_evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "regulatory_tax_rules_document_idx" ON "regulatory_tax_rules" USING btree ("regulatory_document_id");--> statement-breakpoint
CREATE INDEX "regulatory_tax_rules_tax_type_idx" ON "regulatory_tax_rules" USING btree ("tax_type");