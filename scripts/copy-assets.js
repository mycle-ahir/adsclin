const fs = require('fs');
const path = require('path');

const srcMigrations = path.resolve(__dirname, '../src/main/db/migrations');
const distMigrations = path.resolve(__dirname, '../dist/main/main/db/migrations');

if (fs.existsSync(srcMigrations)) {
  fs.mkdirSync(distMigrations, { recursive: true });
  fs.cpSync(srcMigrations, distMigrations, { recursive: true });
  console.log('[build] Migrations copied to dist/main/main/db/migrations');
}
