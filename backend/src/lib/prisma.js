const { PrismaClient } = require('@prisma/client');

// Single shared Prisma client for the app.
const prisma = new PrismaClient();

module.exports = prisma;
