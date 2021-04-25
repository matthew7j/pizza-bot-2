const spaceUsers = message => {
  return message.replace(/(<(?<=<).+?(?=\>)>)/ig, ' $& ');
};

const spaceEmojis = message => {
  return message.replace(/(:(?<=:).+?(?=\:):)/ig, ' $& ');
};

const spaceMessage = message => {
  message = spaceUsers(message);
  message = spaceEmojis(message);

  return message;
};

module.exports = {
  spaceMessage
};
  