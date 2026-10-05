import { faker } from '@faker-js/faker';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PASSWORD = 'password123';
const EVENT_NAME = 'Seeded Demo Event';
const EVENT_DESCRIPTION = 'A fully seeded local event for testing visualisations.';
const PARTICIPANT_COUNT = 50;
const TEAM_COUNT = 10;
const DAYS_OF_STEPS = 28;

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

function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

const today = new Date();
const startDate = new Date(today);
startDate.setDate(today.getDate() - DAYS_OF_STEPS + 1);
const endDate = new Date(today);
endDate.setDate(today.getDate() + 7);

const teamNames = [
  'Spider-Man',
  'Iron Man',
  'Captain America',
  'Thor',
  'Hulk',
  'Black Widow',
  'Hawkeye',
  'Wolverine',
  'Storm',
  'Cyclops',
];

const usedEmails = new Set();
const users = [];

for (let i = 0; i < PARTICIPANT_COUNT; i++) {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const email = generateUniqueEmail(firstName, lastName, usedEmails);
  const displayName = `${firstName} ${lastName}`;
  const { hash, salt } = hashPassword(DEFAULT_PASSWORD);
  users.push({ email, passwordHash: hash, passwordSalt: salt, displayName });
}

const lines = [
  "INSERT OR IGNORE INTO organizations (name, allowed_domain) VALUES ('HubSpot', 'hubspot.com');",
  '',
  ...users.map(
    (u) =>
      `INSERT OR IGNORE INTO users (email, password_hash, password_salt, organization_id, role, display_name) VALUES ('${escapeSql(u.email)}', '${u.passwordHash}', '${u.passwordSalt}', (SELECT id FROM organizations WHERE allowed_domain = 'hubspot.com'), 'user', '${escapeSql(u.displayName)}');`
  ),
  '',
  `DELETE FROM events WHERE name = '${escapeSql(EVENT_NAME)}';`,
  `INSERT INTO events (name, description, starts_at, ends_at) VALUES ('${escapeSql(EVENT_NAME)}', '${escapeSql(EVENT_DESCRIPTION)}', '${formatDate(startDate)}', '${formatDate(endDate)}');`,
  `UPDATE events SET status = 'active', started_at = CURRENT_TIMESTAMP WHERE name = '${escapeSql(EVENT_NAME)}';`,
  '',
  ...teamNames.map(
    (name) =>
      `INSERT INTO teams (event_id, name) VALUES ((SELECT id FROM events WHERE name = '${escapeSql(EVENT_NAME)}'), '${escapeSql(name)}');`
  ),
  '',
  ...users.map(
    (u, index) => {
      const teamName = teamNames[index % TEAM_COUNT];
      return `INSERT INTO event_participants (event_id, user_id, team_id, status) VALUES ((SELECT id FROM events WHERE name = '${escapeSql(EVENT_NAME)}'), (SELECT id FROM users WHERE email = '${escapeSql(u.email)}'), (SELECT id FROM teams WHERE event_id = (SELECT id FROM events WHERE name = '${escapeSql(EVENT_NAME)}') AND name = '${escapeSql(teamName)}'), 'assigned_team');`;
    }
  ),
  '',
];

for (let d = 0; d < DAYS_OF_STEPS; d++) {
  const entryDate = new Date(startDate);
  entryDate.setDate(startDate.getDate() + d);
  const dateStr = formatDate(entryDate);

  for (let i = 0; i < PARTICIPANT_COUNT; i++) {
    const u = users[i];
    const teamName = teamNames[i % TEAM_COUNT];
    const steps = faker.number.int({ min: 3000, max: 18000 });
    lines.push(
      `INSERT INTO step_entries (event_id, user_id, team_id, entry_date, steps, image_key) VALUES ((SELECT id FROM events WHERE name = '${escapeSql(EVENT_NAME)}'), (SELECT id FROM users WHERE email = '${escapeSql(u.email)}'), (SELECT id FROM teams WHERE event_id = (SELECT id FROM events WHERE name = '${escapeSql(EVENT_NAME)}') AND name = '${escapeSql(teamName)}'), '${dateStr}', ${steps}, NULL);`
    );
  }
}

const sqlFile = path.join(__dirname, 'seed-local-event.sql');
fs.writeFileSync(sqlFile, lines.join('\n'));

console.log(`Generated seed SQL for:`);
console.log(`  Event: ${EVENT_NAME}`);
console.log(`  Participants: ${PARTICIPANT_COUNT}`);
console.log(`  Teams: ${TEAM_COUNT}`);
console.log(`  Days of step entries: ${DAYS_OF_STEPS}`);
console.log(`  Total step entries: ${PARTICIPANT_COUNT * DAYS_OF_STEPS}`);
console.log(`  Date range: ${formatDate(startDate)} to ${formatDate(endDate)}`);
console.log(`\nSQL written to ${sqlFile}`);

console.log('\nApplying to local D1 database...');
try {
  execSync(`npx wrangler d1 execute stepchallenge --local --config wrangler.local.jsonc --file ${sqlFile}`, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
  console.log('\nSeed complete. Log in as the existing admin to view the event and reports.');
} catch (err) {
  console.error('\nSeed failed. Make sure local migrations have been applied (`npm run db:migrate:local`).');
  process.exit(1);
}
