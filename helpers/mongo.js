
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

const givePizzaOp = (userId, pizzas) => {
  return {
    updateOne: {
      filter: {
        userId
      },
      update: {
        $inc: {
          pizzas
        }
      }
    }
  };
};

const takePizzaOp = (userId, pizzas) => {
  return {
    updateOne: {
      filter: {
        userId
      },
      update: {
        $inc: {
          pizzas: -pizzas
        }
      }
    }
  };
};

const performMongoOps = async ops => {
  const mongoOptions = { db: 'pizza_bot', collection: 'users' };
  const collection = await mongo(mongoOptions);
  console.log(`ops: ${JSON.stringify(ops)}`);
  await collection.bulkWrite(ops);
}

module.exports = {
    mongo,
    takePizzaOp,
    givePizzaOp,
    performMongoOps
};