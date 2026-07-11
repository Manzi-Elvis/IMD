import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitAttachments1700000004000 implements MigrationInterface {
  name = 'InitAttachments1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "attachments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "incident_id" uuid NOT NULL REFERENCES "incidents"("id") ON DELETE CASCADE,
        "original_name" varchar NOT NULL,
        "storage_key" varchar NOT NULL,
        "mime_type" varchar NOT NULL,
        "size_bytes" bigint NOT NULL,
        "uploaded_by" uuid NOT NULL REFERENCES "users"("id"),
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_attachments_incident_id" ON "attachments" ("incident_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "attachments"`);
  }
}
