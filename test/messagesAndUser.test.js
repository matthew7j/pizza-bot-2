const chai = require("chai");
const { mock } = require("sinon");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const expect = chai.expect;
chai.use(sinonChai);

const messagesAndUsers = require('../helpers/messagesAndUsers.js');

const getMockAppPostEphemeral = () => {
  const mockApp = {
    client: {
      chat: {
        postEphemeral: sinon.spy()
      }
    }
  };

  return mockApp;
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
});