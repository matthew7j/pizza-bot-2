const { App } = require('@slack/bolt');
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

const isUser = msg => {
  return msg.match(/((?<=@).+?(?=\>))/ig);
}

const sendMessageToPizzaReciever = async (pizzaGiver, numPizzas, user, channel, userNameMap, channelMemberList) => {
  let msg;
  if (numPizzas === 1) {
    msg = `You received ${numPizzas} pizza from ${userNameMap.get(pizzaGiver)}.`
  } else {
    msg = `You received ${numPizzas} pizzas from ${userNameMap.get(pizzaGiver)}!`
  }

  if (channelMemberList.members.includes(user)) {
    await app.client.chat.postEphemeral({
      token: process.env.SLACK_BOT_TOKEN,
      user: user,
      channel: channel,
      blocks: [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: msg
        }
      }]
    });
  } else {
    console.log(`${userNameMap.get(user)} is not in this channel, not sending a message`);
  } 
};

const sendMessageToPizzaPeople = async (pizzaUsersObjectArray, userSet, message) => {
  let textString = '';

  const userNameMap = new Map();
  const channelMemberList = await app.client.conversations.members({ token: process.env.SLACK_BOT_TOKEN, channel: message.channel });

  for (let i = 0; i < userSet.size; i++) {
    const userInfo = await app.client.users.info({ token: process.env.SLACK_BOT_TOKEN, user: Array.from(userSet)[i] });
    userNameMap.set(Array.from(userSet)[i], userInfo.user.real_name);
  }

  for (let i = 0; i < pizzaUsersObjectArray.length; i++) {
    let nameString = '';
    const obj = pizzaUsersObjectArray[i];
    for (let i = 0; i < obj.recipients.length; i++) {
      if (i === obj.recipients.length - 1) {
        nameString = obj.recipients.length === 1 ? nameString.concat(`${userNameMap.get(obj.recipients[i])}!`) : nameString.concat(`and ${userNameMap.get(obj.recipients[i])}!`);
      } else {
        nameString = obj.recipients.length === 2 ? nameString.concat(`${userNameMap.get(obj.recipients[i])} `) : nameString.concat(`${userNameMap.get(obj.recipients[i])}, `);
      }

      await sendMessageToPizzaReciever(message.user, obj.pizzas, obj.recipients[i], message.channel, userNameMap, channelMemberList);
    }

    textString = obj.pizzas === 1 ? textString.concat(`You gave ${obj.pizzas} pizza to ${nameString}\n`) : textString.concat(`You gave ${obj.pizzas} pizzas to ${nameString}\n`);
  }

  await app.client.chat.postEphemeral({
    token: process.env.SLACK_BOT_TOKEN,
    user: message.user,
    channel: message.channel,
    blocks: [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: textString
      }
    }]
  });
};

app.message(/(:pizza:).*/, async ({ message, say }) => {
  const splitMessage = message.text.split(' ');
  let counter = -1;
  const pizzaUsersObjectArray = [{
    pizzas: 0,
    recipients: []
  }];
  let totalPizzas = 0;

  for (let i = 0; i < splitMessage.length; i++) {
    const msg = splitMessage[i];
    if (isUser(msg)) {
      if (counter < 0) {
        counter = 0;
      }
      if (pizzaUsersObjectArray[counter].pizzas > 0) {
        counter++;
        let newPizzaUserObject = {
          pizzas: 0,
          recipients: []
        };
        pizzaUsersObjectArray.push(newPizzaUserObject);
      }
      pizzaUsersObjectArray[counter].recipients.push(msg.substring(2, msg.length - 1));
    } else if (msg === ':pizza:' || msg === ':pizzapie:') {
      if (counter < 0) {
        await app.client.chat.postEphemeral({
          token: process.env.SLACK_BOT_TOKEN,
          user: message.user,
          channel: message.channel,
          blocks: [{
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: "Oops, that's not how you send pizzas :face_palm:! Do something like `@user :pizza:` instead!"
            }
          }]
        });

        return;
      } else {
        pizzaUsersObjectArray[counter].pizzas++;
        const multiplier = pizzaUsersObjectArray[counter].recipients.length;
        totalPizzas += multiplier;
      }
    }
  }

  if (pizzaUsersObjectArray.length > 0 && pizzaUsersObjectArray[0].recipients.length > 0) {
    const mongoOptions = { db: 'pizza_bot', collection: 'users' };
    const collection = await mongo(mongoOptions);
    const ops = [];
    const userSet = new Set();
    userSet.add(message.user);

    pizzaUsersObjectArray.forEach(pizzaUserObj => {
      pizzaUserObj.recipients.forEach(recipient => {
        userSet.add(recipient);
        ops.push(takePizzaOp(message.user, pizzaUserObj.pizzas));
        ops.push(givePizzaOp(recipient, pizzaUserObj.pizzas));
      }); 
    });

    const userPizzaInfo = await collection.findOne({ userId: message.user });

    if (userPizzaInfo.pizzas - totalPizzas < 0) {
      await app.client.chat.postEphemeral({
        token: process.env.SLACK_BOT_TOKEN,
        user: message.user,
        channel: message.channel,
        blocks: [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Oops, you do not have enough pizzas for this. You tried giving ${totalPizzas} pizzas but you only have ${userPizzaInfo.pizzas}!`
          }
        }]
      });
    } else {
      await collection.bulkWrite(ops);
      await sendMessageToPizzaPeople(pizzaUsersObjectArray, userSet, message);
    }
  }
});

app.message(/(:pizzapie:).*/, async ({ message, say }) => {
  const splitMessage = message.text.split(' ');
  let counter = -1;
  const pizzapieUsersObjectArray = [{
    pizzas: 0,
    recipients: []
  }];
  let totalPizzas = 0;

  splitMessage.forEach(msg => {
    if (isUser(msg)) {
      if (counter < 0) {
        counter = 0;
      }
      if (pizzapieUsersObjectArray[counter].pizzapies > 0) {
        counter++;
        let newPizzaPieUserObject = {
          pizzas: 0,
          recipients: []
        };
        pizzapieUsersObjectArray.push(newPizzaPieUserObject);
      }
      pizzapieUsersObjectArray[counter].recipients.push(msg.substring(2, msg.length - 1));
    } else if (msg === ':pizzapie:' || msg === ':pizza') {
      if (counter < 0) {
        app.client.chat.postEphemeral({
          token: process.env.SLACK_BOT_TOKEN,
          user: message.user,
          channel: message.channel,
          blocks: [{
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: "Oops, that's not how you send pizza pies :face_palm:! Do something like `@user :pizzapie:` instead!"
            }
          }]
        });
      } else {
        pizzapieUsersObjectArray[counter].pizzas += 8;
        const multiplier = pizzapieUsersObjectArray[counter].recipients.length;
        totalPizzas += (multiplier * 8);
      }
    }
  });

  if (pizzapieUsersObjectArray.length > 0 && pizzapieUsersObjectArray[0].recipients.length > 0) {
    const mongoOptions = { db: 'pizza_bot', collection: 'users' };
    const collection = await mongo(mongoOptions);
    const ops = [];
    const userSet = new Set();
    userSet.add(message.user);

    pizzapieUsersObjectArray.forEach(pizzapieUserObj => {
      pizzapieUserObj.recipients.forEach(recipient => {
        ops.push(takePizzaOp(message.user, pizzapieUserObj.pizzas));
        userSet.add(recipient);
        ops.push(givePizzaOp(recipient, pizzapieUserObj.pizzas));
      }); 
    });

    const userPizzaInfo = await collection.findOne({ userId: message.user });
    console.log(`1: ${userPizzaInfo.pizzas}`);
    console.log(`2: ${totalPizzas}`);
    if (userPizzaInfo.pizzas - totalPizzas < 0) {
      await app.client.chat.postEphemeral({
        token: process.env.SLACK_BOT_TOKEN,
        user: message.user,
        channel: message.channel,
        blocks: [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Oops, you do not have enough pizzas for this. You tried giving ${totalPizzas} pizzas but you only have ${userPizzaInfo.pizzas}!`
          }
        }]
      });
    } else {
     // await collection.bulkWrite(ops);
      await sendMessageToPizzaPeople(pizzapieUsersObjectArray, userSet, message);
    }
  }
});

const sendMessageToReactionPizzaPeople = async (reactionUser, messageUser, channel, numPizzas) => {
  const userNameMap = new Map();
  const messageUserInfo = await app.client.users.info({ token: process.env.SLACK_BOT_TOKEN, user: messageUser });
  const reactionUserInfo = await app.client.users.info({ token: process.env.SLACK_BOT_TOKEN, user: reactionUser });
  userNameMap.set(messageUser, messageUserInfo.user.real_name);
  userNameMap.set(reactionUser, reactionUserInfo.user.real_name);

  let messageToReceiver = '';
  let messageToReactor = '';

  if (numPizzas > 1) {
    messageToReceiver = `You received ${numPizzas} pizzas from ${userNameMap.get(reactionUser)}!`;
    messageToReactor = `You gave ${numPizzas} pizzas to ${userNameMap.get(messageUser)}!`;
  } else {
    messageToReceiver = `You received ${numPizzas} pizza from ${userNameMap.get(reactionUser)}!`;
    messageToReactor = `You gave ${numPizzas} pizza to ${userNameMap.get(messageUser)}!`;
  }

  await app.client.chat.postEphemeral({
    token: process.env.SLACK_BOT_TOKEN,
    user: messageUser,
    channel: channel,
    blocks: [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: messageToReceiver
      }
    }]
  });

  await app.client.chat.postEphemeral({
    token: process.env.SLACK_BOT_TOKEN,
    user: reactionUser,
    channel: channel,
    blocks: [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: messageToReactor
      }
    }]
  });
}  

app.event('reaction_added', async ({ event }) => {
  if (event.reaction === 'pizza') {
    const mongoOptions = { db: 'pizza_bot', collection: 'users' };
    const collection = await mongo(mongoOptions);
    const ops = [];

    ops.push(takePizzaOp(event.user, 1));
    ops.push(givePizzaOp(event.item_user, 1));

    await collection.bulkWrite(ops);
    await sendMessageToReactionPizzaPeople(event.user, event.item_user, event.item.channel, 1);
  } else if (event.reaction === 'zap') {
    const mongoOptions = { db: 'pizza_bot', collection: 'users' };
    const collection = await mongo(mongoOptions);
    const ops = [];

    ops.push(takePizzaOp(event.user, 8));
    ops.push(givePizzaOp(event.item_user, 8));

    await collection.bulkWrite(ops);
    await sendMessageToReactionPizzaPeople(event.user, event.item_user, event.item.channel, 8);
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