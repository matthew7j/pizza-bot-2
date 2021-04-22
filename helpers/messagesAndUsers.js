const getUserIdsFromText = message => {
  const usersMatch = message.text.match(/((?<=@).+?(?=\>))/ig);
    
  if (!usersMatch) return {};

  return usersMatch.reduce((out, input) => {
    if(out[input]) {
      out[input] += 1;
    } else {
      out[input] = 1;
    }
    return out;
  }, {});
};

module.exports = {
  getUserIdsFromText
};
