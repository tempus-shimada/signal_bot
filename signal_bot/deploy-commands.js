// ------------------------------
// Deploy Script for Discord Bot Slash Commands
// ------------------------------
//
// This script registers (or updates) your bot's slash commands for a specific Discord server (guild).
// You must replace the placeholder values for clientId, guildId, and token with your actual values.
// Run this script whenever you add or change your slash commands to update them in Discord.
require('dotenv').config({ path: require('path').resolve(__dirname, '../creds.env') });


// Import the REST module and Routes from discord.js.
// The REST module is used to make HTTP requests to Discord's API.
// Routes helps build the correct API endpoint URLs.
const { REST, Routes } = require('discord.js');

// ------------------------------
// Define Your Bot's Credentials
// ------------------------------
// clientId: Your bot's application ID, found in the Discord Developer Portal.
// guildId: The ID of the Discord server (guild) where you are testing your bot.
// token: Your bot's token (keep this secret!).
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const token = process.env.BOT_TOKEN;

// Define your slash commands.
const commands = [
  {
    name: 'bootup',
    description: 'Scans the server and lets you select the channel to send messages.',
  },
  {
    name: 'configure',
    description: 'Displays current configuration and allows editing via an interactive form.',
  },
  {
    name: 'prime',
    description: 'Primes the message with Strike, Option (C/P), and Premium values.',
    options: [
      {
        name: 'strike',
        type: 4, // INTEGER
        description: 'Strike value (integer)',
        required: true,
      },
      {
        name: 'option',
        type: 3, // STRING
        description: 'Option type (C or P)',
        required: true,
        choices: [
          { name: 'C', value: 'C' },
          { name: 'P', value: 'P' },
        ],
      },
      {
        name: 'premium',
        type: 10, // NUMBER
        description: 'Premium value (number)',
        required: true,
      },
    ],
  },
  {
    name: 'signal',
    description: 'Sends the primed message to the configured channel.',
  },
  {
    name: 'close',
    description: 'Sends a follow-up "Exited" message to the channel used by /signal.',
  },
  {
    name: 'clearbot',
    description: 'Clears messages sent by the bot in this channel.',
  },
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();