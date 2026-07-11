import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitIncidentEvents1700000003000 implements MigrationInterface {
  name = 'InitIncidentEvents1700000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "incident_event_type_enum" AS ENUM
        ('created', 'status_change', 'severity_change', 'assignment_change', 'comment', 'attachment_added')
    `);

    await queryRunner.query(`
      CREATE TABLE "incident_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "incident_id" uuid NOT NULL REFERENCES "incidents"("id") ON DELETE CASCADE,
        "type" "incident_event_type_enum" NOT NULL,
        "author_id" uuid NOT NULL REFERENCES "users"("id"),
        "content" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Timeline is always queried "give me every event for incident X, in
    // order" — index on the FK makes that an index scan instead of a
    // sequential scan as the table grows across many incidents.
    await queryRunner.query(`
      CREATE INDEX "IDX_incident_events_incident_id" ON "incident_events" ("incident_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "incident_events"`);
    await queryRunner.query(`DROP TYPE "incident_event_type_enum"`);
  }
}
