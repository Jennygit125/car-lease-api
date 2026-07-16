import { MigrationInterface, QueryRunner } from "typeorm";

export class MyFirst1784210346258 implements MigrationInterface {
    name = 'MyFirst1784210346258'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vehicles" ADD "description" text`);
        await queryRunner.query(`CREATE INDEX "IDX_e1dccd62e423b93f139336d50c" ON "vehicles" ("fuelType") `);
        await queryRunner.query(`CREATE INDEX "IDX_e4ad321033bddad18665b7d9d2" ON "vehicles" ("transmission") `);
        await queryRunner.query(`CREATE INDEX "IDX_c55804ec0ac024aeae95d7e6dc" ON "vehicles" ("minRentDays") `);
        await queryRunner.query(`CREATE INDEX "IDX_bfed3aa4c9fa966ab664a6410d" ON "vehicles" ("maxRentDays") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2e5bf46c6d976e30ef0400c5f" ON "vehicles" ("isAvailable") `);
        await queryRunner.query(`CREATE INDEX "IDX_2ecdb33f23e9a6fc392025c0b9" ON "wallets" ("userId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_2ecdb33f23e9a6fc392025c0b9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f2e5bf46c6d976e30ef0400c5f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bfed3aa4c9fa966ab664a6410d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c55804ec0ac024aeae95d7e6dc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e4ad321033bddad18665b7d9d2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e1dccd62e423b93f139336d50c"`);
        await queryRunner.query(`ALTER TABLE "vehicles" DROP COLUMN "description"`);
    }

}
