import { runMigrations } from "@agent-native/core/db";

import { chaupalMigrations } from "../db/migrations.js";

export default runMigrations(chaupalMigrations, { table: "chaupal_migrations" });
