const { givePizzaOp, performMongoOps, takePizzaOp, getMongoCollection } = require('../helpers/mongo');
require('dotenv').config();

const forEach = require('../utils/forEach');
const messagesAndUsers = require('../helpers/messagesAndUsers');

const createNewEmptyPizzaUserObject = () => {
  return {
    pizzas: 0,
    recipients: []
  };
};

const getTopTen = async () => {
  const collection = await getMongoCollection();
  return await collection.find().sort({ pizzas: -1 }).limit(10).toArray();
};

const checkIfUserCanSendPizzas = async (app, message, totalPizzas) => {
  const collection = await getMongoCollection();
  console.log(`collection: ${collection}`);
  const userPizzaInfo = await collection.findOne({ userId: message.user });

  if (userPizzaInfo.pizzas - totalPizzas < 0) {
    await messagesAndUsers.sendEphemeralMessage(app, message, `Oops, you do not have enough pizzas for this. You tried giving ${totalPizzas} pizzas but you only have ${userPizzaInfo.pizzas}!`);
  }
};

const getMongoPizzaOps = (message, pizzaUsersObjectArray) => {
  const ops = [];

  pizzaUsersObjectArray.forEach(pizzaUserObj => {
    pizzaUserObj.recipients.forEach(recipient => {
      ops.push(takePizzaOp(message.user, pizzaUserObj.pizzas));
      ops.push(givePizzaOp(recipient, pizzaUserObj.pizzas));
    }); 
  });

  return ops;
};

const handlePizzaMessage = async (app, message, supportedEmojis) => {
  let counter = 0;
  let totalPizzas = 0;

  const splitMessage = message.text.split(' ').reverse().filter(el => el !== '');
  const pizzaUsersObjectArray = [];
  pizzaUsersObjectArray.push(createNewEmptyPizzaUserObject());

  await forEach(splitMessage, async msg => {
    if (msg === ':pizza:') {
      if (pizzaUsersObjectArray[counter].recipients.length === 0) {
        pizzaUsersObjectArray[counter].pizzas++;
      } else {
        pizzaUsersObjectArray.push(createNewEmptyPizzaUserObject());
        pizzaUsersObjectArray[++counter].pizzas++;
      }
    } else if (messagesAndUsers.isUser(msg)) {
      if (pizzaUsersObjectArray[counter].pizzas > 0) {
        totalPizzas += pizzaUsersObjectArray[counter].pizzas;
        pizzaUsersObjectArray[counter].recipients.push(msg.substring(2, msg.length - 1));
      }
    } else {
      // Need to add logic here to stop if another valid emoji is found after users
    }
  });
  
  await checkIfUserCanSendPizzas(app, message, totalPizzas);
  await performMongoOps(getMongoPizzaOps(message, pizzaUsersObjectArray));
  await messagesAndUsers.sendPizzaMessages(app, pizzaUsersObjectArray, message);
};

const handlePizzaReaction = async (app, event, numPizzas) => {
  await checkIfUserCanSendPizzas(app, { user: event.user, channel: event.item.channel }, numPizzas);

  const ops = [];
  ops.push(takePizzaOp(event.user, numPizzas));
  ops.push(givePizzaOp(event.item_user, numPizzas));
  await performMongoOps(ops);
  await messagesAndUsers.sendPizzaMessagesReactions(app, event.user, event.item_user, event.item.channel, numPizzas);
};

const handlePizzasCommand  = async (app, command) => {
  const collection = await getMongoCollection();
  const userInfo = await collection.findOne({ userId: command.user_id });
  await messagesAndUsers.sendEphemeralMessage(app, { user: command.user_id, channel: command.channel_id }, `You currently have ${userInfo.pizzas} pizzas.`);
};

const handlePizzaLeaderBoardCommand = async (app, command) => {
  const topTen = await getTopTen();
  const leaderBoard = [];

  leaderBoard.push({
    type: 'header',
    text: {
      type: 'plain_text',
      text: ':pizza: Leaderboard :pizza:',
      emoji: true
    }
  });

  await forEach(topTen, user => {
    leaderBoard.push({
      type: 'section',
      text: {
        type: 'plain_text',
        text: user.name,
        emoji: true
      },
      accessory: {
        type: 'button',
        text: {
          type: 'plain_text',
          text: `${user.pizzas} :pizza:`,
          emoji: true
        }
      }
    })
  });

  await messagesAndUsers.sendEphemeralBlock(app, { user: command.user_id, channel: command.channel_id, block: leaderBoard });
};

module.exports = {
  handlePizzaMessage,
  handlePizzaReaction,
  handlePizzasCommand,
  handlePizzaLeaderBoardCommand
}