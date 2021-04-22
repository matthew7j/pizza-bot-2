
const { MongoClient } = require('mongodb');

require('dotenv').config();

const client = new MongoClient(process.env.MONGO_URI, { useUnifiedTopology: true });

const mongo = async options => {
    let collection;
    try {
        await client.connect();
        const db = await client.db(options.db);
        collection = await db.collection(options.collection);
    } catch (err) {
        console.error(err);
    }
    return collection;
};

module.exports = {
    mongo
};