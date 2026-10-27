const db = require('./db');

console.log('🌱 Seeding SQLite database for AgentCart AI...');
db.initTables();
const products = db.getAllProducts();
console.log(`✅ Successfully verified ${products.length} technical jackets in SQLite.`);
process.exit(0);
