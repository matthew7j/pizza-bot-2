const { mongo, givePizzaOp, performMongoOps, takePizzaOp } = require('../helpers/mongo');
require('dotenv').config();

const forEach = require('../utils/forEach');
const { isUser, sendEphemeralMessage, sendPizzaMessages, sendPizzaMessagesReactions } = require('../helpers/messagesAndUsers');

const createNewEmptyPizzaUserObject = () => {
  return {
    pizzas: 0,
    recipients: []
  };
};

const checkIfUserCanSendPizzas = async (app, message, totalPizzas) => {
  const mongoOptions = { db: 'pizza_bot', collection: 'users' };
  const collection = await mongo(mongoOptions);
  const userPizzaInfo = await collection.findOne({ userId: message.user });

  if (userPizzaInfo.pizzas - totalPizzas < 0) {
    await sendEphemeralMessage(app, message, `Oops, you do not have enough pizzas for this. You tried giving ${totalPizzas} pizzas but you only have ${userPizzaInfo.pizzas}!`);
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
    } else if (isUser(msg)) {
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
  await sendPizzaMessages(app, pizzaUsersObjectArray, message);
};

const handlePizzaReaction = async (app, event, numPizzas) => {
  await checkIfUserCanSendPizzas(app, { user: event.user, channel: event.item.channel }, numPizzas);

  const ops = [];
  ops.push(takePizzaOp(event.user, numPizzas));
  ops.push(givePizzaOp(event.item_user, numPizzas));
  await performMongoOps(ops);
  await sendPizzaMessagesReactions(app, event.user, event.item_user, event.item.channel, numPizzas);
};

module.exports = {
  handlePizzaMessage,
  handlePizzaReaction
}