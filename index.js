const { App } = require('@slack/bolt');

const { mongo } = require('./helpers/mongo');
const { spaceMessage } = require('./helpers/spaceMessage');
const pizzas = require('./lib/pizzas');
require('dotenv').config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET
});

app.message(/(:pizza:)|(:pizzapie:).*/, async ({ message }) => {
  message.text = spaceMessage(message.text);
  pizzas.handlePizzaMessage(app, message);
});

app.event('reaction_added', async ({ event }) => {
  if (event.reaction === 'pizza') {
    pizzas.handlePizzaReaction(app, event, 1);
  } else if (event.reaction === 'pizzapie') {
    pizzas.handlePizzaReaction(app, event, 8);
  }
});

app.command('/pizzas', async ({ command, ack }) => {
  await ack();
  await pizzas.handlePizzasCommand(app, command);
});

app.command('/leaderboard', async ({ command, ack }) => {
  await ack();
  await pizzas.handlePizzaLeaderBoardCommand(app, command);
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