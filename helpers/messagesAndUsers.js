const isUser = msg => {
  if (typeof msg !== 'string') return false;
  return !!msg.match(/((?<=@).+?(?=\>))/ig);
}

const sendEphemeralMessage = async (app, message, text) => {
  await app.client.chat.postEphemeral({
    token: process.env.SLACK_BOT_TOKEN,
    user: message.user,
    channel: message.channel,
    blocks: [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text
      }
    }]
  });
};

const sendEphemeralBlock = async (app, message) => {
  await app.client.chat.postEphemeral({
    token: process.env.SLACK_BOT_TOKEN,
    user: message.user,
    channel: message.channel,
    blocks: message.block
  });
};

const sendPizzaMessages = async (app, pizzaUsersObjectArray, message) => {
  let textString = '';
  const userSet = getUserSet(pizzaUsersObjectArray, message);
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
        nameString = obj.recipients.length === 1 ? nameString.concat(`${userNameMap.get(obj.recipients[i])}`) : nameString.concat(`and ${userNameMap.get(obj.recipients[i])}`);
      } else {
        nameString = obj.recipients.length === 2 ? nameString.concat(`${userNameMap.get(obj.recipients[i])} `) : nameString.concat(`${userNameMap.get(obj.recipients[i])}, `);
      }
      await sendMessageToPizzaReciever(app, message.user, obj.pizzas, obj.recipients[i], message.channel, userNameMap, channelMemberList);
    }

    textString = obj.pizzas === 1 ? textString.concat(`You gave ${obj.pizzas} pizza to ${nameString}. `) : textString.concat(`You gave ${obj.pizzas} pizzas to ${nameString}. `);
  }

  await sendEphemeralMessage(app, message, textString.substring(0, textString.length - 1));
};

const sendMessageToPizzaReciever = async (app, pizzaGiver, numPizzas, user, channel, userNameMap, channelMemberList) => {
  let msg;
  if (numPizzas === 1) {
    msg = `You received ${numPizzas} pizza from ${userNameMap.get(pizzaGiver)}.`
  } else {
    msg = `You received ${numPizzas} pizzas from ${userNameMap.get(pizzaGiver)}.`
  }
  if (channelMemberList.members.includes(user)) {
    await sendEphemeralMessage(app, { user, channel }, msg);
  } else {
    await sendEphemeralMessage(app, { user: pizzaGiver, channel }, `${userNameMap.get(user)} is not in this channel, not sending a message to them. :sad:`);
  } 
};

const getUserSet = (pizzaUsersObjectArray, message) => {
  const userSet = new Set();
  userSet.add(message.user);
  
  pizzaUsersObjectArray.forEach(pizzaUserObj => {
    pizzaUserObj.recipients.forEach(recipient => {
      userSet.add(recipient);
    }); 
  });

  return userSet;
};

const sendPizzaMessagesReactions = async (app, reactionUser, messageUser, channel, numPizzas) => {
  const userNameMap = new Map();
  const messageUserInfo = await app.client.users.info({ token: process.env.SLACK_BOT_TOKEN, user: messageUser });
  const reactionUserInfo = await app.client.users.info({ token: process.env.SLACK_BOT_TOKEN, user: reactionUser });
  userNameMap.set(messageUser, messageUserInfo.user.real_name);
  userNameMap.set(reactionUser, reactionUserInfo.user.real_name);

  let messageToReceiver = '';
  let messageToReactor = '';

  if (numPizzas > 1) {
    messageToReceiver = `You received ${numPizzas} pizzas from ${userNameMap.get(reactionUser)}.`;
    messageToReactor = `You gave ${numPizzas} pizzas to ${userNameMap.get(messageUser)}.`;
  } else {
    messageToReceiver = `You received ${numPizzas} pizza from ${userNameMap.get(reactionUser)}.`;
    messageToReactor = `You gave ${numPizzas} pizza to ${userNameMap.get(messageUser)}.`;
  }

  await sendEphemeralMessage(app, { user: messageUser, channel }, messageToReceiver);
  await sendEphemeralMessage(app, { user: reactionUser, channel }, messageToReactor);
}  

module.exports = {
  isUser,
  sendEphemeralMessage,
  sendPizzaMessages,
  sendPizzaMessagesReactions,
  sendEphemeralBlock
};
