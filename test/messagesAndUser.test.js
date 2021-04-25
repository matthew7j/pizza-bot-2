const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const expect = chai.expect;
chai.use(sinonChai);

const forEach = require('../utils/forEach');
const messagesAndUsers = require('../helpers/messagesAndUsers.js');

const getMockAppPostEphemeral = () => {
  return {
    client: {
      chat: {
        postEphemeral: sinon.spy()
      }
    }
  };
};

const getMockForPizzaMessages = (token, userArray, channel, membersArray) => {
  const infoStub = sinon.stub();

  userArray.forEach(u => {
    infoStub.withArgs({ token, user: u.user }).resolves({ user: { real_name: u.real_name }});
  });

  const membersStub = sinon.stub();
  membersStub.withArgs({ token, channel }).resolves({ members: membersArray });

  return {
    client: {
      conversations: {
        members: membersStub
      },
      chat: {
        postEphemeral: sinon.spy()
      },
      users: {
        info: infoStub
      }
    }
  };
};

describe('messagesAndUser', () => {
  describe('isUser()', () => {
    [{ assertion: true, value: '<@UMK89S39>' }, { assertion: false, value: 'banana' }, { assertion: false, value: 0 },
      { assertion: false, value: 1 }, { assertion: false, value: 3.14 }, { assertion: false, value: -1 },
      { assertion: false, value: null }, { assertion: false, value: undefined }, { assertion: false, value: {} },
      { assertion: false, value: [] 
    }].forEach(testCase => {
      it(`Should return: ${testCase.assertion} for value: ${testCase.value}`, () => {
        expect(messagesAndUsers.isUser(testCase.value)).to.equal(testCase.assertion);
      });
    });
  });

  describe('sendEphemeralMessage()', () => {
    let app;
    let oldSlackBotToken;
    const testToken = 'test_token';

    beforeEach(() => {
      app = getMockAppPostEphemeral();
      oldSlackBotToken = process.env.SLACK_BOT_TOKEN;
      process.env.SLACK_BOT_TOKEN = testToken;
    });

    afterEach(() => {
      delete process.env.SLACK_BOT_TOKEN;
      process.env.SLACK_BOT_TOKEN = oldSlackBotToken;
    });

    it('Should call postEphemeral with correct arguments', async () => {
      const message = { user: 123, channel: 345 };
      const text = 'penguins';

      await messagesAndUsers.sendEphemeralMessage(app, message, text);
      expect(app.client.chat.postEphemeral).to.have.been.calledWith({
        token: testToken,
        user: message.user,
        channel: message.channel,
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text } }]
      });
    });
  });

  describe('sendEphemeralBlock()', () => {
    let app;
    let oldSlackBotToken;
    const testToken = 'test_token';

    beforeEach(() => {
      app = getMockAppPostEphemeral();
      oldSlackBotToken = process.env.SLACK_BOT_TOKEN;
      process.env.SLACK_BOT_TOKEN = testToken;
    });

    afterEach(() => {
      delete process.env.SLACK_BOT_TOKEN;
    });

    it('Should call postEphemeral with correct arguments', async () => {
      const block = [{ type: 'section', text: { type: 'mrkdwn', text: 'test text' } }];
      const message = { user: 123, channel: 345, block };

      await messagesAndUsers.sendEphemeralBlock(app, message);
      expect(app.client.chat.postEphemeral).to.have.been.calledWith({
        token: testToken,
        user: message.user,
        channel: message.channel,
        blocks: block
      });
    });
  });

  describe('sendPizzaMessages()', () => {
    let oldSlackBotToken;
    const testToken = 'test_token';
    const channel = '123';

    beforeEach(() => {
      oldSlackBotToken = process.env.SLACK_BOT_TOKEN;
      process.env.SLACK_BOT_TOKEN = testToken;
    });

    afterEach(() => {
      delete process.env.SLACK_BOT_TOKEN;
      process.env.SLACK_BOT_TOKEN = oldSlackBotToken;
      sinon.restore();
    });

    const testCases = [{
      userArray: [{ user: 'U00', real_name: 'name 0'}, { user: 'U01', real_name: 'name 1'}],
      membersArray: ['U00', 'U01'],
      pizzaUsersObjectArray: [{ pizzas: 1, recipients: ['U01'] }],
      message: { user: 'U00', channel },
      messages: ['You received 1 pizza from name 0.', 'You gave 1 pizza to name 1.']
    }, {
      userArray: [{ user: 'U00', real_name: 'name 0'}, { user: 'U01', real_name: 'name 1'}, { user: 'U02', real_name: 'name 2'}],
      membersArray: ['U00', 'U01', 'U02'],
      pizzaUsersObjectArray: [{ pizzas: 2, recipients: ['U01', 'U02'] }, { pizzas: 3, recipients: ['U02'] }],
      message: { user: 'U00', channel },
      messages: ['You received 2 pizzas from name 0.', 'You received 2 pizzas from name 0.', 'You received 3 pizzas from name 0.',
      'You gave 2 pizzas to name 1 and name 2. You gave 3 pizzas to name 2.']
    }, {
      userArray: [{ user: 'U00', real_name: 'name 0'}, { user: 'U01', real_name: 'name 1'}, { user: 'U02', real_name: 'name 2'}, { user: 'U03', real_name: 'name 3'}],
      membersArray: ['U00', 'U01', 'U02', 'U03'],
      pizzaUsersObjectArray: [{ pizzas: 2, recipients: ['U01', 'U02', 'U03'] }, { pizzas: 3, recipients: ['U02'] }],
      message: { user: 'U00', channel },
      messages: ['You received 2 pizzas from name 0.', 'You received 2 pizzas from name 0.', 'You received 2 pizzas from name 0.',
      'You received 3 pizzas from name 0.', 'You gave 2 pizzas to name 1, name 2, and name 3. You gave 3 pizzas to name 2.']
    }];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];

      it('Should send correct messages to correct people', async () => {
        const app = getMockForPizzaMessages(testToken, testCase.userArray, channel, testCase.membersArray);
        await messagesAndUsers.sendPizzaMessages(app, testCase.pizzaUsersObjectArray, testCase.message);

        expect(app.client.chat.postEphemeral).to.have.callCount(testCase.messages.length);

        let count = 0;
        testCase.pizzaUsersObjectArray.forEach(obj => {
          obj.recipients.forEach(rec => {
            expect(app.client.chat.postEphemeral.getCall(count).args).to.deep.equal([{ token: testToken, 
              user: rec, channel,
              blocks: [{type: 'section', text: { type: 'mrkdwn', text: testCase.messages[count] }}]
            }]);
            count++;
          });
        });

        expect(app.client.chat.postEphemeral.getCall(count).args).to.deep.equal([{ token: testToken, 
          user: testCase.message.user, channel,
          blocks: [{type: 'section', text: { type: 'mrkdwn', text: testCase.messages[count] }}]
        }]);
      });
    }

    it('Should send correct message if trying to send a message to user not in the channel', async () => {
      const testCase = {
        userArray: [{ user: 'U00', real_name: 'name 0'}, { user: 'U01', real_name: 'name 1' }, { user: 'U02', real_name: 'name 2' }],
        membersArray: ['U00', 'U01'],
        pizzaUsersObjectArray: [{ pizzas: 1, recipients: ['U01'] }, { pizzas: 1, recipients: ['U02'] }],
        message: { user: 'U00', channel },
        messages: ['You received 1 pizza from name 0.', 'name 2 is not in this channel, not sending a message to them. :sad:', 
          'You gave 1 pizza to name 1. You gave 1 pizza to name 2.'],
        recs: ['U01', 'U00']
      };

      const app = getMockForPizzaMessages(testToken, testCase.userArray, channel, testCase.membersArray);
      await messagesAndUsers.sendPizzaMessages(app, testCase.pizzaUsersObjectArray, testCase.message);
      expect(app.client.chat.postEphemeral).to.have.callCount(testCase.messages.length);

      let count = 0;
      testCase.pizzaUsersObjectArray.forEach(obj => {
        obj.recipients.forEach(rec => {
          expect(app.client.chat.postEphemeral.getCall(count).args).to.deep.equal([{ token: testToken, 
            user: testCase.recs[count], channel,
            blocks: [{type: 'section', text: { type: 'mrkdwn', text: testCase.messages[count] }}]
          }]);
          count++;
        });
      });

      expect(app.client.chat.postEphemeral.getCall(count).args).to.deep.equal([{ token: testToken, 
        user: testCase.message.user, channel,
        blocks: [{type: 'section', text: { type: 'mrkdwn', text: testCase.messages[count] }}]
      }]);
    });
  });

  describe('sendPizzaReactions()', () => {
    let oldSlackBotToken;
    const testToken = 'test_token';
    const channel = '123';

    beforeEach(() => {
      oldSlackBotToken = process.env.SLACK_BOT_TOKEN;
      process.env.SLACK_BOT_TOKEN = testToken;
    });

    afterEach(() => {
      delete process.env.SLACK_BOT_TOKEN;
      process.env.SLACK_BOT_TOKEN = oldSlackBotToken;
      sinon.restore();
    });

    const testCases = [{
      userArray: [{ user: 'U00', real_name: 'name 0'}, { user: 'U01', real_name: 'name 1' }],
      membersArray: ['U00', 'U01'],
      pizzaUsersObjectArray: [{ pizzas: 1, recipients: ['U01'] }],
      message: { user: 'U00', channel },
      messages: ['You received 1 pizza from name 0.', 'You gave 1 pizza to name 1.']
    }, {
      userArray: [{ user: 'U00', real_name: 'name 0'}, { user: 'U01', real_name: 'name 1' }],
      membersArray: ['U00', 'U01'],
      pizzaUsersObjectArray: [{ pizzas: 8, recipients: ['U01'] }],
      message: { user: 'U00', channel },
      messages: ['You received 8 pizzas from name 0.', 'You gave 8 pizzas to name 1.']
    }];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];

      it('Should send correct message if trying to send a message to user not in the channel', async () => {
        const app = getMockForPizzaMessages(testToken, testCase.userArray, channel, testCase.membersArray);
        await messagesAndUsers.sendPizzaMessagesReactions(app, testCase.message.user, testCase.userArray[1].user, channel, testCase.pizzaUsersObjectArray[0].pizzas);
        expect(app.client.chat.postEphemeral).to.have.callCount(testCase.messages.length);
  
        let count = 0;
        testCase.pizzaUsersObjectArray.forEach(obj => {
          obj.recipients.forEach(rec => {
            expect(app.client.chat.postEphemeral.getCall(count).args).to.deep.equal([{ token: testToken, 
              user: rec, channel,
              blocks: [{type: 'section', text: { type: 'mrkdwn', text: testCase.messages[count] }}]
            }]);
            count++;
          });
        });
  
        expect(app.client.chat.postEphemeral.getCall(count).args).to.deep.equal([{ token: testToken, 
          user: testCase.message.user, channel,
          blocks: [{type: 'section', text: { type: 'mrkdwn', text: testCase.messages[count] }}]
        }]);
      });
    }
  });
});
