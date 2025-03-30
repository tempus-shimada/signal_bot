// ------------------------------
// Import Required Libraries
// ------------------------------
require('dotenv').config({ path: require('path').resolve(__dirname, '../creds.env') });

const { 
  Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, 
  ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, EmbedBuilder, 
  ChannelSelectMenuBuilder, ChannelType, MessageFlags 
} = require('discord.js');
const express = require('express');
const fs = require('fs'); // if needed for persistent config
const app = express();

// Use express JSON parser for API endpoints.
app.use(express.json());

// ------------------------------
// Create Discord Client
// ------------------------------
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });

// ------------------------------
// Global Configuration
// ------------------------------
const config = {
  strike: null,             // Integer strike price.
  option: null,             // Option type: 'C' or 'P'.
  premium: null,            // Starting premium (price) of the option.
  sendChannel: null,        // Channel ID for public messaging.
  lastSignaledChannel: null // Channel used for the last signal (for /close).
};

// ------------------------------
// Discord Bot Ready Event
// ------------------------------
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ------------------------------
// Discord Interaction Handlers
// ------------------------------
client.on('interactionCreate', async (interaction) => {
  if (!interaction.guildId) return; // Ensure we're in a guild.

  // --- Slash Commands ---
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'bootup') {
      // /bootup: Let the user choose the channel to send messages.
      const sendChannelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_send_channel')
        .setPlaceholder('Select Channel to Send Messages')
        .setChannelTypes([ChannelType.GuildText]);
      const row = new ActionRowBuilder().addComponents(sendChannelSelect);
      await interaction.reply({ 
        content: 'Please select the channel where messages should be sent:', 
        components: [row], 
        flags: MessageFlags.Ephemeral 
      });
    }
    else if (interaction.commandName === 'configure') {
      // /configure: Display current configuration and allow editing.
      const embed = new EmbedBuilder()
        .setTitle('Current Configuration')
        .setDescription(
          `**Strike:** ${config.strike !== null ? config.strike : 'Not set'}${config.option ? config.option : ''}\n` +
          `**Premium:** ${config.premium !== null ? config.premium : 'Not set'}\n` +
          `**Send Channel:** ${config.sendChannel ? `<#${config.sendChannel}>` : 'Not set'}`
        );
      const editTextButton = new ButtonBuilder()
        .setCustomId('edit_text_fields')
        .setLabel('Edit Strike/Option/Premium')
        .setStyle(ButtonStyle.Primary);
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_send_channel_config')
        .setPlaceholder('Select Send Channel')
        .setChannelTypes([ChannelType.GuildText]);
      const row1 = new ActionRowBuilder().addComponents(editTextButton);
      const row2 = new ActionRowBuilder().addComponents(channelSelect);
      await interaction.reply({ 
        embeds: [embed], 
        components: [row1, row2], 
        flags: MessageFlags.Ephemeral 
      });
    }
    else if (interaction.commandName === 'prime') {
      // /prime: Update config with Strike, Option, and Premium.
      const strike = interaction.options.getInteger('strike');
      const optionType = interaction.options.getString('option');
      const premium = interaction.options.getNumber('premium');
      config.strike = strike;
      config.option = optionType;
      config.premium = premium;
      // Calculate the range: 10% and 20% increase.
      const lowerBound = (premium * 1.10).toFixed(2);
      const upperBound = (premium * 1.20).toFixed(2);
      // Send the public (non-ephemeral) message with @everyone.
      await interaction.channel.send({
        content: `@everyone SPY ${strike}${optionType} spotted at $${premium} — watching for potential move toward the ${lowerBound} - ${upperBound} range.`,
        allowedMentions: { parse: ['everyone'] }
      });
      // Then send an ephemeral confirmation to the user.
      await interaction.reply({ content: 'Prime message sent publicly.', ephemeral: true });
    }
    else if (interaction.commandName === 'signal') {
      // /signal: Send the primed message to the configured channel.
      if (!config.strike || !config.option || !config.premium) {
        return interaction.reply({ content: 'Please prime the message first using /prime.', flags: MessageFlags.Ephemeral });
      }
      if (!config.sendChannel) {
        return interaction.reply({ content: 'Send channel not configured. Use /bootup or /configure to set it.', flags: MessageFlags.Ephemeral });
      }
      try {
        const targetChannel = await client.channels.fetch(config.sendChannel);
        if (!targetChannel || !targetChannel.isTextBased()) {
          return interaction.reply({ content: 'Configured channel is not valid or not text-based.', flags: MessageFlags.Ephemeral });
        }
        const lowerBound = (config.premium * 1.10).toFixed(2);
        const upperBound = (config.premium * 1.20).toFixed(2);
        const finalMessage = `SPY ${config.strike}${config.option} spotted at $${config.premium} — watching for potential move toward the ${lowerBound} - ${upperBound} range.`;
        // Send a public message with @everyone
        await targetChannel.send({
          content: `@everyone ${finalMessage}`,
          allowedMentions: { parse: ['everyone'] }
        });
        config.lastSignaledChannel = config.sendChannel;
        await interaction.reply({ content: 'Signal message sent publicly.', ephemeral: true });
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Error sending signal.', flags: MessageFlags.Ephemeral });
      }
    }
    else if (interaction.commandName === 'close') {
      // /close: Send an "Exited" message to the last signaled channel.
      if (!config.lastSignaledChannel) {
        return interaction.reply({ content: 'No previous signal channel found.', flags: MessageFlags.Ephemeral });
      }
      try {
        const channel = await client.channels.fetch(config.lastSignaledChannel);
        if (!channel || !channel.isTextBased()) {
          return interaction.reply({ content: 'The signal channel is not valid or text-based.', flags: MessageFlags.Ephemeral });
        }
        await channel.send({
          content: `@everyone Exited`,
          allowedMentions: { parse: ['everyone'] }
        });
        await interaction.reply({ content: 'Close message sent publicly.', ephemeral: true });
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Error sending close message.', flags: MessageFlags.Ephemeral });
      }
    }
    else if (interaction.commandName === 'clearbot') {
      // /clearbot: Clear messages sent by the bot in the current channel.
      const channel = interaction.channel;
      try {
        const messages = await channel.messages.fetch({ limit: 100 });
        const botMessages = messages.filter(m => m.author.id === client.user.id);
        if (botMessages.size === 0) {
          return interaction.reply({ content: 'No messages from the bot found in this channel.', flags: MessageFlags.Ephemeral });
        }
        const now = Date.now();
        const twoWeeks = 14 * 24 * 60 * 60 * 1000;
        const bulkDeletable = botMessages.filter(m => (now - m.createdTimestamp) < twoWeeks);
        const oldMessages = botMessages.filter(m => (now - m.createdTimestamp) >= twoWeeks);
        if (bulkDeletable.size > 0) {
          await channel.bulkDelete(bulkDeletable);
        }
        for (const message of oldMessages.values()) {
          await message.delete();
        }
        await interaction.reply({ content: `Deleted ${botMessages.size} messages from the bot.`, flags: MessageFlags.Ephemeral });
      } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'Error clearing messages.', flags: MessageFlags.Ephemeral });
      }
    }
  }

  // ------------------------------
  // Handle Button and Modal Interactions
  // ------------------------------
  if (interaction.isButton()) {
    if (interaction.customId === 'edit_text_fields') {
      // Open a modal to edit Strike, Option, and Premium.
      const modal = new ModalBuilder()
        .setCustomId('edit_text_modal')
        .setTitle('Edit Strike, Option & Premium');
      const strikeInput = new TextInputBuilder()
        .setCustomId('strike_input')
        .setLabel('Enter Strike (integer)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(config.strike !== null ? `${config.strike}` : 'e.g., 275')
        .setRequired(true);
      const optionInput = new TextInputBuilder()
        .setCustomId('option_input')
        .setLabel('Enter Option (C or P)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(config.option ? config.option : 'C or P')
        .setRequired(true);
      const premiumInput = new TextInputBuilder()
        .setCustomId('premium_input')
        .setLabel('Enter Premium (number)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(config.premium !== null ? `${config.premium}` : 'e.g., 2.00')
        .setRequired(true);
      const row1 = new ActionRowBuilder().addComponents(strikeInput);
      const row2 = new ActionRowBuilder().addComponents(optionInput);
      const row3 = new ActionRowBuilder().addComponents(premiumInput);
      modal.addComponents(row1, row2, row3);
      await interaction.showModal(modal);
    }
  }
  if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'edit_text_modal') {
    const newStrike = interaction.fields.getTextInputValue('strike_input');
    const newOption = interaction.fields.getTextInputValue('option_input');
    const newPremium = interaction.fields.getTextInputValue('premium_input');
    const parsedStrike = parseInt(newStrike, 10);
    const parsedPremium = parseFloat(newPremium);
    if (isNaN(parsedStrike) || (newOption !== 'C' && newOption !== 'P') || isNaN(parsedPremium)) {
      return interaction.reply({ content: 'Invalid input. Ensure Strike and Premium are numbers and Option is C or P.', flags: MessageFlags.Ephemeral });
    }
    config.strike = parsedStrike;
    config.option = newOption;
    config.premium = parsedPremium;
    await interaction.reply({ content: 'Configuration updated via modal!', flags: MessageFlags.Ephemeral });
  }
  if (interaction.isChannelSelectMenu()) {
    if (interaction.customId === 'select_send_channel' || interaction.customId === 'select_send_channel_config') {
      const selected = interaction.values[0];
      config.sendChannel = selected;
      await interaction.reply({ content: `Send channel set to <#${selected}>.`, flags: MessageFlags.Ephemeral });
    }
  }
});

// ------------------------------
// Express API Endpoints
// ------------------------------

// GET /channels: Returns a list of text channels for the bot's first guild.
app.get('/channels', async (req, res) => {
  try {
    const guild = client.guilds.cache.first();
    if (!guild) return res.status(400).json({ message: 'No guild found' });
    await guild.channels.fetch();
    const channels = guild.channels.cache.filter(ch => ch.isTextBased() && ch.type === ChannelType.GuildText);
    const channelList = channels.map(ch => ({ id: ch.id, name: ch.name }));
    res.json(channelList);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching channels' });
  }
});

// POST /setChannel: Sets the send channel in configuration.
app.post('/setChannel', (req, res) => {
  const { channelId } = req.body;
  if (!channelId) {
    return res.status(400).json({ message: 'channelId is required' });
  }
  config.sendChannel = channelId;
  res.json({ message: `Send channel set to ${channelId}` });
});

// POST /prime: Update configuration with provided Strike, Option, and Premium values and return a preview.
app.post('/prime', (req, res) => {
  const { strike, option, premium } = req.body;
  config.strike = parseInt(strike, 10);
  config.option = option;
  config.premium = parseFloat(premium);
  const lowerBound = (config.premium * 1.10).toFixed(2);
  const upperBound = (config.premium * 1.20).toFixed(2);
  res.json({
    message: 'Primed',
    strike: config.strike,
    option: config.option,
    premium: config.premium,
    preview: `SPY ${config.strike}${config.option} spotted at $${config.premium} — watching for potential move toward the ${lowerBound} - ${upperBound} range.`
  });
});

// POST /signal: Send the primed message to the configured channel.
app.post('/signal', async (req, res) => {
  if (!config.strike || !config.option || !config.premium || !config.sendChannel) {
    return res.status(400).json({ message: 'Configuration incomplete. Prime values and set send channel first.' });
  }
  try {
    const targetChannel = await client.channels.fetch(config.sendChannel);
    if (!targetChannel || !targetChannel.isTextBased()) {
      return res.status(400).json({ message: 'Configured channel is invalid.' });
    }
    const lowerBound = (config.premium * 1.10).toFixed(2);
    const upperBound = (config.premium * 1.20).toFixed(2);
    const finalMessage = `SPY ${config.strike}${config.option} spotted at $${config.premium} — watching for potential move toward the ${lowerBound} - ${upperBound} range.`;
    await targetChannel.send({
      content: `@everyone ${finalMessage}`,
      allowedMentions: { parse: ['everyone'] }
    });
    config.lastSignaledChannel = config.sendChannel;
    res.json({ message: 'Signal sent', finalMessage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error sending signal' });
  }
});

// POST /close: Send a follow-up "Exited" message to the last signaled channel.
app.post('/close', async (req, res) => {
  if (!config.lastSignaledChannel) {
    return res.status(400).json({ message: 'No previous signal channel found.' });
  }
  try {
    const channel = await client.channels.fetch(config.lastSignaledChannel);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ message: 'The signal channel is invalid.' });
    }
    await channel.send({
      content: `@everyone Exited`,
      allowedMentions: { parse: ['everyone'] }
    });
    res.json({ message: 'Exited message sent' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error sending close signal' });
  }
});

// ------------------------------
// Start Express Server on Port 3000
// ------------------------------
app.listen(3000, () => {
  console.log('Express API running on port 3000');
});

// ------------------------------
// Log in the Discord Bot
// ------------------------------
// Replace 'YOUR_BOT_TOKEN' with your actual bot token in your creds.env file.
client.login(process.env.BOT_TOKEN);
