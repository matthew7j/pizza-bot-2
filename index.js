const { App } = require('@slack/bolt');
const { getUserIdsFromText } = require('./helpers/messagesAndUsers');
const { mongo } = require('./helpers/mongo');
require('dotenv').config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

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

app.message(/(:pizza:).*/, async ({ message, say }) => {
  const usersToGivePizzas = Object.keys(getUserIdsFromText(message));

  if (usersToGivePizzas.length !== 0) {
    const mongoOptions = { db: 'pizza_bot', collection: 'users' };
    const collection = await mongo(mongoOptions);
    const ops = [];
    ops.push(takePizzaOp(message.user, 1));
    ops.push(givePizzaOp(usersToGivePizzas[0], 1));

    await collection.bulkWrite(ops);
  }
});

(async () => {
  await app.start(process.env.PORT || 3000);
  console.log('Pizza Bot is running!');

  const mongoOptions = { db: 'pizza_bot', collection: 'users' };
  const collection = await mongo(mongoOptions);
  const ops = [];

  const userList = await app.client.users.list({ token: process.env.SLACK_BOT_TOKEN });

  userList.members.forEach(user => {
    if (user.name !== 'slackbot' && !user.is_bot) {
      ops.push({
        updateOne: {
          filter: {
              userId: user.id
          },
          update: {
              $setOnInsert: { pizzas : 8, name: user.real_name }
          },
          upsert: true
        }
      });
    }
  });

  await collection.bulkWrite(ops, { ordered: false });
})();