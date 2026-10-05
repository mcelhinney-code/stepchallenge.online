import { faker } from '@faker-js/faker';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PASSWORD = 'password123';
const COUNT = Number(process.argv[2]) || 10;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 32, 'sha256');
  return {
    hash: hash.toString('hex'),
    salt: salt.toString('hex'),
  };
}

function sanitizeForEmail(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function generateUniqueEmail(firstName, lastName, usedEmails) {
  const base = `${sanitizeForEmail(firstName)}.${sanitizeForEmail(lastName)}`;
  let email = `${base}@hubspot.com`;
  let attempt = 1;
  while (usedEmails.has(email)) {
    email = `${base}${attempt}@hubspot.com`;
    attempt++;
  }
  usedEmails.add(email);
  return email;
}

const usedEmails = new Set();
const users = [];

for (let i = 0; i < COUNT; i++) {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const email = generateUniqueEmail(firstName, lastName, usedEmails);
  const displayName = `${firstName} ${lastName}`;
  const { hash, salt } = hashPassword(DEFAULT_PASSWORD);

  users.push({
    email,
    passwordHash: hash,
    passwordSalt: salt,
    displayName,
  });
}

const sqlLines = [
  "INSERT OR IGNORE INTO organizations (name, allowed_domain) VALUES ('HubSpot', 'hubspot.com');",
  '',
  ...users.map(
    (u) =>
      `INSERT OR IGNORE INTO users (email, password_hash, password_salt, organization_id, role, display_name) VALUES ('${u.email}', '${u.passwordHash}', '${u.passwordSalt}', (SELECT id FROM organizations WHERE allowed_domain = 'hubspot.com'), 'user', '${u.displayName.replace(/'/g, "''")}');`
  ),
];

const sqlFile = path.join(__dirname, 'seed-users.sql');
fs.writeFileSync(sqlFile, sqlLines.join('\n'));

console.log(`Generated ${users.length} test users:`);
users.forEach((u) => console.log(`  ${u.displayName} <${u.email}>`));
console.log(`\nDefault password for all: ${DEFAULT_PASSWORD}`);
console.log(`SQL written to ${sqlFile}`);

console.log('\nApplying to local D1 database...');
try {
  execSync(`npx wrangler d1 execute stepchallenge --local --config wrangler.local.jsonc --file ${sqlFile}`, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
  console.log('\nSeed complete.');
} catch (err) {
  console.error('\nSeed failed. Make sure local migrations have been applied (`npm run db:migrate:local`).');
  process.exit(1);
}
