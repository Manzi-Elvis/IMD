import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitAuditLogs1700000005000 implements MigrationInterface {
  name = 'InitAuditLogs1700000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actor_id" uuid NOT NULL,
        "actor_email" varchar NOT NULL,
        "action" varchar NOT NULL,
        "entity_type" varchar NOT NULL,
        "entity_id" uuid NULL,
        "metadata" jsonb NULL,
        "ip_address" varchar NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // No FK to users/incidents on purpose — audit history must survive the
    // referenced entity being deleted (see AuditLog entity comment).
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_actor" ON "audit_logs" ("actor_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}
