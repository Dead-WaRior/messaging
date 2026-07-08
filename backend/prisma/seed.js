// Seed demo data. Run: node prisma/seed.js
// Idempotent-ish: skips users that already exist by username.

const bcrypt = require('bcrypt');
const prisma = require('../src/lib/prisma');

const DEMO_PASSWORD = 'password123';

const users = [
  { username: 'alice',  email: 'alice@example.com',  bio: 'coffee & code' },
  { username: 'bob',    email: 'bob@example.com',    bio: 'building stuff' },
  { username: 'carol',  email: 'carol@example.com',  bio: 'designer / photographer' },
  { username: 'dave',   email: 'dave@example.com',   bio: 'reads a lot' },
];

const seedPosts = [
  { by: 'alice', content: 'first post! hello world 👋' },
  { by: 'bob',   content: 'just shipped a new feature. feels good.' },
  { by: 'carol', content: 'sunset over the bay tonight was unreal.' },
  { by: 'alice', content: 'why do all my side projects turn into full apps' },
  { by: 'dave',  content: 'reading "The Pragmatic Programmer" — still holds up.' },
  { by: 'bob',   content: 'unpopular opinion: SQL is a great API' },
];

async function main() {
  console.log('seeding…');
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const map = {};

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { username: u.username } });
    if (existing) { map[u.username] = existing; continue; }
    const created = await prisma.user.create({
      data: { username: u.username, email: u.email, password_hash: hash, bio: u.bio },
    });
    map[u.username] = created;
    console.log(`  user: ${u.username}`);
  }

  for (const p of seedPosts) {
    const author = map[p.by];
    if (!author) continue;
    const exists = await prisma.post.findFirst({
      where: { user_id: author.id, content: p.content },
    });
    if (exists) continue;
    await prisma.post.create({ data: { user_id: author.id, content: p.content } });
    console.log(`  post by ${p.by}: ${p.content.slice(0, 40)}…`);
  }

  // Basic follow graph
  const follows = [
    ['alice', 'bob'], ['alice', 'carol'],
    ['bob', 'alice'], ['bob', 'dave'],
    ['carol', 'alice'], ['dave', 'bob'],
  ];
  for (const [a, b] of follows) {
    const A = map[a], B = map[b];
    if (!A || !B) continue;
    try {
      await prisma.follow.create({ data: { follower_id: A.id, following_id: B.id } });
    } catch (e) { if (e.code !== 'P2002') throw e; }
  }

  // Some likes
  const allPosts = await prisma.post.findMany();
  const allUsers = Object.values(map);
  for (const post of allPosts) {
    for (const u of allUsers) {
      if (u.id === post.user_id) continue;
      if (Math.random() < 0.5) {
        try {
          await prisma.like.create({ data: { post_id: post.id, user_id: u.id } });
        } catch (e) { if (e.code !== 'P2002') throw e; }
      }
    }
  }

  console.log(`\ndone. demo password for all users: "${DEMO_PASSWORD}"`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
