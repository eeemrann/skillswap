const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

let replSet;

/** Boots an in-memory single-node replica set (required for multi-document transactions). */
async function startDb() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await mongoose.connect(replSet.getUri(), { dbName: 'skillswap-test' });
  const { syncIndexes } = require('../../models');
  await syncIndexes();
}

async function stopDb() {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
}

async function clearDb() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

module.exports = { startDb, stopDb, clearDb };
