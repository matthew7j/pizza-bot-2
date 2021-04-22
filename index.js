const { Botkit } = require('botkit');
const { SlackAdapter, SlackEventMiddleware } = require('botbuilder-adapter-slack');
require('dotenv').config();

(async () => {
  const adapter = new SlackAdapter({
    clientSigningSecret: process.env.BOT_SECRET,
    botToken: process.env.BOT_TOKEN
  });

  adapter.use(new SlackEventMiddleware())

  const controller = new Botkit({
    webhook_uri: '/api/messages',
    adapter: adapter
  });

  controller.on('message', async(bot, message) => {
    await bot.reply(message, 'Hey');
  });

  controller.ready(() => {
    controller.loadModules(__dirname + '/features');
  });

  controller.webserver.get('/', (req, res) => {
    res.send(`This app is running Botkit ${ controller.version }.`);
  });
})();
