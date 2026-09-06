CREATE TYPE "public"."evidence_status" AS ENUM('official-verified', 'official-source-pending-review');--> statement-breakpoint
CREATE TYPE "public"."evidence_type" AS ENUM('official-source', 'official-publication');--> statement-breakpoint
CREATE TYPE "public"."regulatory_status" AS ENUM('in-force', 'amended', 'repealed', 'draft', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."update_run_status" AS ENUM('running', 'succeeded', 'partial', 'failed');--> statement-breakpoint
CREATE TABLE "regulatory_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"verified_version_id" integer,
	"title" text NOT NULL,
	"title_arabic" text,
	"instrument_type" text NOT NULL,
	"instrument_number" text,
	"authority" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"status" "regulatory_status" NOT NULL,
	"official_source_url" text NOT NULL,
	"publication_date" date,
	"effective_date" date,
	"summary" text NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applicability" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"obligations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"related_record_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_status" "evidence_status" DEFAULT 'official-source-pending-review' NOT NULL,
	"languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_verified_at" timestamp with time zone,
	CONSTRAINT "regulatory_documents_topics_array" CHECK (jsonb_typeof("regulatory_documents"."topics") = 'array'),
	CONSTRAINT "regulatory_documents_aliases_array" CHECK (jsonb_typeof("regulatory_documents"."aliases") = 'array'),
	CONSTRAINT "regulatory_documents_applicability_array" CHECK (jsonb_typeof("regulatory_documents"."applicability") = 'array'),
	CONSTRAINT "regulatory_documents_obligations_array" CHECK (jsonb_typeof("regulatory_documents"."obligations") = 'array'),
	CONSTRAINT "regulatory_documents_related_ids_array" CHECK (jsonb_typeof("regulatory_documents"."related_record_ids") = 'array'),
	CONSTRAINT "regulatory_documents_languages_valid" CHECK (jsonb_typeof("regulatory_documents"."languages") = 'array' and "regulatory_documents"."languages" <@ '["en", "ar"]'::jsonb),
	CONSTRAINT "regulatory_documents_verification_state" CHECK (("regulatory_documents"."evidence_status" = 'official-verified' and "regulatory_documents"."verified_version_id" is not null and "regulatory_documents"."last_verified_at" is not null) or ("regulatory_documents"."evidence_status" = 'official-source-pending-review' and "regulatory_documents"."verified_version_id" is null and "regulatory_documents"."last_verified_at" is null))
);
--> statement-breakpoint
CREATE TABLE "regulatory_evidence" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"version_id" integer NOT NULL,
	"source_id" text NOT NULL,
	"type" "evidence_type" NOT NULL,
	"url" text NOT NULL,
	"excerpt" text,
	"captured_at" timestamp with time zone NOT NULL,
	"review_status" "review_status" DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regulatory_evidence_review_complete" CHECK (("regulatory_evidence"."review_status" = 'pending' and "regulatory_evidence"."reviewed_at" is null and "regulatory_evidence"."reviewed_by" is null) or ("regulatory_evidence"."review_status" in ('verified', 'rejected') and "regulatory_evidence"."reviewed_at" is not null and nullif(btrim("regulatory_evidence"."reviewed_by"), '') is not null))
);
--> statement-breakpoint
CREATE TABLE "regulatory_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"authority" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"canonical_url" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_changed_at" timestamp with time zone,
	CONSTRAINT "regulatory_sources_changed_after_checked" CHECK ("regulatory_sources"."last_changed_at" is null or "regulatory_sources"."last_checked_at" is null or "regulatory_sources"."last_changed_at" <= "regulatory_sources"."last_checked_at")
);
--> statement-breakpoint
CREATE TABLE "regulatory_update_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "update_run_status" NOT NULL,
	"checked_sources" integer DEFAULT 0 NOT NULL,
	"changed_sources" integer DEFAULT 0 NOT NULL,
	"processed_documents" integer DEFAULT 0 NOT NULL,
	"error_summary" text,
	CONSTRAINT "regulatory_update_runs_counts_nonnegative" CHECK ("regulatory_update_runs"."checked_sources" >= 0 and "regulatory_update_runs"."changed_sources" >= 0 and "regulatory_update_runs"."processed_documents" >= 0),
	CONSTRAINT "regulatory_update_runs_changed_lte_checked" CHECK ("regulatory_update_runs"."changed_sources" <= "regulatory_update_runs"."checked_sources"),
	CONSTRAINT "regulatory_update_runs_finished_state" CHECK (("regulatory_update_runs"."status" = 'running' and "regulatory_update_runs"."finished_at" is null) or ("regulatory_update_runs"."status" <> 'running' and "regulatory_update_runs"."finished_at" is not null and "regulatory_update_runs"."finished_at" >= "regulatory_update_runs"."started_at"))
);
--> statement-breakpoint
CREATE TABLE "regulatory_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"version" integer NOT NULL,
	"content_hash" text NOT NULL,
	"raw_content" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"review_status" "review_status" DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regulatory_versions_version_positive" CHECK ("regulatory_versions"."version" > 0),
	CONSTRAINT "regulatory_versions_hash_sha256" CHECK ("regulatory_versions"."content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "regulatory_versions_review_complete" CHECK (("regulatory_versions"."review_status" = 'pending' and "regulatory_versions"."reviewed_at" is null and "regulatory_versions"."reviewed_by" is null) or ("regulatory_versions"."review_status" in ('verified', 'rejected') and "regulatory_versions"."reviewed_at" is not null and nullif(btrim("regulatory_versions"."reviewed_by"), '') is not null))
);
--> statement-breakpoint
ALTER TABLE "regulatory_documents" ADD CONSTRAINT "regulatory_documents_source_id_regulatory_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."regulatory_sources"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "regulatory_documents" ADD CONSTRAINT "regulatory_documents_verified_version_id_regulatory_versions_id_fk" FOREIGN KEY ("verified_version_id") REFERENCES "public"."regulatory_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_evidence" ADD CONSTRAINT "regulatory_evidence_document_id_regulatory_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."regulatory_documents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "regulatory_evidence" ADD CONSTRAINT "regulatory_evidence_source_id_regulatory_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."regulatory_sources"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "regulatory_evidence" ADD CONSTRAINT "regulatory_evidence_version_document_fk" FOREIGN KEY ("version_id","document_id") REFERENCES "public"."regulatory_versions"("id","document_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_evidence" ADD CONSTRAINT "regulatory_evidence_document_source_fk" FOREIGN KEY ("document_id","source_id") REFERENCES "public"."regulatory_documents"("id","source_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "regulatory_versions" ADD CONSTRAINT "regulatory_versions_document_id_regulatory_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."regulatory_documents"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "regulatory_documents_source_idx" ON "regulatory_documents" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "regulatory_documents_source_instrument_unique" ON "regulatory_documents" USING btree ("source_id","instrument_type","instrument_number");--> statement-breakpoint
CREATE UNIQUE INDEX "regulatory_documents_id_source_unique" ON "regulatory_documents" USING btree ("id","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "regulatory_evidence_version_url_unique" ON "regulatory_evidence" USING btree ("version_id","url");--> statement-breakpoint
CREATE INDEX "regulatory_evidence_document_idx" ON "regulatory_evidence" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "regulatory_evidence_source_idx" ON "regulatory_evidence" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "regulatory_sources_canonical_url_unique" ON "regulatory_sources" USING btree ("canonical_url");--> statement-breakpoint
CREATE INDEX "regulatory_update_runs_started_at_idx" ON "regulatory_update_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "regulatory_versions_document_version_unique" ON "regulatory_versions" USING btree ("document_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "regulatory_versions_document_hash_unique" ON "regulatory_versions" USING btree ("document_id","content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "regulatory_versions_id_document_unique" ON "regulatory_versions" USING btree ("id","document_id");
--> statement-breakpoint
CREATE FUNCTION enforce_verified_regulatory_documents() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM regulatory_documents document
		LEFT JOIN regulatory_versions version
			ON version.id = document.verified_version_id
			AND version.document_id = document.id
			AND version.review_status = 'verified'
		WHERE document.evidence_status = 'official-verified'
			AND (
				version.id IS NULL
				OR NOT EXISTS (
					SELECT 1
					FROM regulatory_evidence evidence
					WHERE evidence.version_id = version.id
						AND evidence.document_id = document.id
						AND evidence.source_id = document.source_id
						AND evidence.review_status = 'verified'
				)
			)
	) THEN
		RAISE EXCEPTION 'verified documents require a verified version and verified official evidence belonging to the same document and source';
	END IF;

	RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER regulatory_documents_verified_version_guard
AFTER INSERT OR UPDATE OF id, source_id, verified_version_id, evidence_status
ON regulatory_documents
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_verified_regulatory_documents();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER regulatory_versions_verified_document_guard
AFTER INSERT OR UPDATE OR DELETE
ON regulatory_versions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_verified_regulatory_documents();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER regulatory_evidence_verified_document_guard
AFTER INSERT OR UPDATE OR DELETE
ON regulatory_evidence
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_verified_regulatory_documents();
