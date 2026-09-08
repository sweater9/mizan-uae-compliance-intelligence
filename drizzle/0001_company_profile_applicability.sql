ALTER TABLE regulatory_documents ADD COLUMN IF NOT EXISTS applicability_rules jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE regulatory_documents ADD COLUMN IF NOT EXISTS applicability_match_mode text NOT NULL DEFAULT 'all';

CREATE TABLE IF NOT EXISTS company_profiles (
  id text PRIMARY KEY,
  owner_key text,
  legal_name text NOT NULL,
  jurisdiction text NOT NULL,
  authorities jsonb NOT NULL DEFAULT '[]'::jsonb,
  legal_form text,
  sector text,
  regulated boolean,
  financial_services boolean,
  activities jsonb NOT NULL DEFAULT '[]'::jsonb,
  licence_category text,
  employee_band text,
  vat_status text,
  corporate_tax_status text,
  aml_reporting_entity boolean,
  dnfbp_category text,
  free_zone_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applicability_assessments (
  id text PRIMARY KEY,
  profile_id text NOT NULL REFERENCES company_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applicability_results (
  id text PRIMARY KEY,
  assessment_id text NOT NULL REFERENCES applicability_assessments(id),
  regulatory_document_id text NOT NULL REFERENCES regulatory_documents(id),
  state text NOT NULL,
  triggered_attributes jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_information jsonb NOT NULL DEFAULT '[]'::jsonb,
  reasoning text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS applicability_assessments_profile_idx ON applicability_assessments(profile_id);
CREATE INDEX IF NOT EXISTS applicability_results_assessment_idx ON applicability_results(assessment_id);
