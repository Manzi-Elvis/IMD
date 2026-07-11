import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitIncidents1700000002000 implements MigrationInterface {
  name = 'InitIncidents1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "incident_severity_enum" AS ENUM ('sev1', 'sev2', 'sev3', 'sev4')
    `);
    await queryRunner.query(`
      CREATE TYPE "incident_status_enum" AS ENUM
        ('open', 'investigating', 'identified', 'monitoring', 'resolved', 'postmortem')
    `);

    await queryRunner.query(`
      CREATE TABLE "incidents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar NOT NULL,
        "description" text NOT NULL,
        "severity" "incident_severity_enum" NOT NULL,
        "status" "incident_status_enum" NOT NULL DEFAULT 'open',
        "reporter_id" uuid NOT NULL REFERENCES "users"("id"),
        "owner_id" uuid NULL REFERENCES "users"("id"),
        "search_vector" tsvector,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "resolved_at" timestamptz NULL
      )
    `);

    // Composite index backing the common dashboard query: "open incidents,
    // grouped/sorted by severity". Matches the @Index(['status','severity'])
    // on the entity.
    await queryRunner.query(`
      CREATE INDEX "IDX_incidents_status_severity" ON "incidents" ("status", "severity")
    `);

    // GIN index is what makes @@ plainto_tsquery() searches fast instead of
    // a sequential scan across every incident's search_vector.
    await queryRunner.query(`
      CREATE INDEX "IDX_incidents_search_vector" ON "incidents" USING GIN ("search_vector")
    `);

    // Trigger function keeps search_vector in sync on every insert/update,
    // weighting the title higher than the description so title matches rank
    // above body matches in relevance-ordered search.
    await queryRunner.query(`
      CREATE FUNCTION incidents_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER incidents_search_vector_trigger
      BEFORE INSERT OR UPDATE OF title, description ON "incidents"
      FOR EACH ROW EXECUTE FUNCTION incidents_search_vector_update();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER "incidents_search_vector_trigger" ON "incidents"`);
    await queryRunner.query(`DROP FUNCTION "incidents_search_vector_update"`);
    await queryRunner.query(`DROP TABLE "incidents"`);
    await queryRunner.query(`DROP TYPE "incident_status_enum"`);
    await queryRunner.query(`DROP TYPE "incident_severity_enum"`);
  }
}
