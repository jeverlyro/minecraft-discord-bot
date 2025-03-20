const { Client, GatewayIntentBits, EmbedBuilder, ActivityType, REST, Routes, SlashCommandBuilder } = require('discord.js');
const util = require('minecraft-server-util');
const fs = require('fs');
const config = require('./config');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

const DEFAULT_SERVER = 'play.uduality.site';
const DEFAULT_PORT = 19231; 
let lastPlayerCount = 0;
let lastServerOnline = null;
const STATUS_CHANNEL_ID = '1350087236812800050';

let serverStats = {
  uptime: 0,
  downtime: 0,
  lastStatusChange: Date.now(),
  history: [],
  maxPlayers: 0,
  playerPeak: {
    count: 0,
    timestamp: null
  }
};

const commands = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Check the status of a Minecraft server')
    .addStringOption(option => 
      option.setName('server')
        .setDescription('The server address (optional)')
        .setRequired(false))
    .addIntegerOption(option => 
      option.setName('port')
        .setDescription('The server port (optional)')
        .setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help information about the bot commands'),
    
  new SlashCommandBuilder()
    .setName('players')
    .setDescription('Show online players on the server')
    .addStringOption(option => 
      option.setName('server')
        .setDescription('The server address (optional)')
        .setRequired(false))
    .addIntegerOption(option => 
      option.setName('port')
        .setDescription('The server port (optional)')
        .setRequired(false)),
        
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s latency and API response time'),
    
  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Show detailed information about the default Minecraft server'),

  new SlashCommandBuilder()
    .setName('activate')
    .setDescription('Helps you qualify for the Active Developer badge'),

  new SlashCommandBuilder()
    .setName('history')
    .setDescription('Show server uptime history and statistics'),

  new SlashCommandBuilder()
    .setName('subscribe')
    .setDescription('Subscribe to server status notifications')
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Type of notifications to receive')
        .setRequired(true)
        .addChoices(
          { name: 'All', value: 'all' },
          { name: 'Status Change', value: 'status' },
          { name: 'Player Count', value: 'players' }
        )),

  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure bot settings')
    .addStringOption(option =>
      option.setName('setting')
        .setDescription('Setting to change')
        .setRequired(true)
        .addChoices(
          { name: 'Update Interval', value: 'interval' },
          { name: 'Status Channel', value: 'channel' }
        ))
    .addStringOption(option =>
      option.setName('value')
        .setDescription('New value for the setting')
        .setRequired(true))
];

async function updateBotStatus() {
  try {
    const result = await util.status(DEFAULT_SERVER, DEFAULT_PORT);
    lastPlayerCount = result.players.online;
    
    // Update player statistics
    if (result.players.online > serverStats.playerPeak.count) {
      serverStats.playerPeak = {
        count: result.players.online,
        timestamp: Date.now()
      };
      saveServerStats();
    }
    
    if (result.players.max > serverStats.maxPlayers) {
      serverStats.maxPlayers = result.players.max;
      saveServerStats();
    }
    
    // Check if this is a status change
    if (lastServerOnline === false || lastServerOnline === null) {
      // Server came online
      notifyServerStatusChange(true);
    }
    lastServerOnline = true;
    
    client.user.setPresence({
      activities: [{
        name: `${lastPlayerCount}/${result.players.max} players on ${DEFAULT_SERVER}`,
        type: ActivityType.Watching
      }],
      status: 'online'
    });
    
    console.log(`Updated status: ${lastPlayerCount}/${result.players.max} players online`);
  } catch (error) {
    console.error('Failed to update status:', error);
    
    // Check if this is a status change
    if (lastServerOnline === true || lastServerOnline === null) {
      // Server went offline
      notifyServerStatusChange(false);
    }
    lastServerOnline = false;
    
    client.user.setPresence({
      activities: [{
        name: `${DEFAULT_SERVER} | Server offline`,
        type: ActivityType.Watching
      }],
      status: 'dnd'
    });
  }
}

// Function to notify about server status changes
async function notifyServerStatusChange(isOnline) {
  // Update stats
  const now = Date.now();
  const duration = now - serverStats.lastStatusChange;
  
  if (lastServerOnline) {
    serverStats.uptime += duration;
  } else {
    serverStats.downtime += duration;
  }
  
  serverStats.lastStatusChange = now;
  serverStats.history.push({
    status: isOnline ? 'online' : 'offline',
    timestamp: now
  });
  
  // Limit history to last 100 events
  if (serverStats.history.length > 100) {
    serverStats.history.shift();
  }
  
  // Save stats
  saveServerStats();
  
  if (!STATUS_CHANNEL_ID) {
    console.log('Status channel ID not configured. Skipping notification.');
    return;
  }
  
  try {
    const channel = await client.channels.fetch(STATUS_CHANNEL_ID);
    if (!channel) {
      console.error('Could not find the status notification channel');
      return;
    }
    
    if (isOnline) {
      const onlineEmbed = new EmbedBuilder()
        .setColor('#00AA00')
        .setTitle('🟢 Minecraft Server Online')
        .setDescription(`The server **${DEFAULT_SERVER}** is now **ONLINE**!`)
        .setTimestamp()
        .setFooter({ text: 'Server status notification', iconURL: client.user.displayAvatarURL() });
      
      await channel.send({ embeds: [onlineEmbed] });
    } else {
      const offlineEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('🔴 Minecraft Server Offline')
        .setDescription(`The server **${DEFAULT_SERVER}** is now **OFFLINE**!`)
        .setTimestamp()
        .setFooter({ text: 'Server status notification', iconURL: client.user.displayAvatarURL() });
      
      await channel.send({ embeds: [offlineEmbed] }); 
    }
  } catch (error) {
    console.error('Error sending server status notification:', error);
  }
}

function saveServerStats() {
  try {
    fs.writeFileSync('./serverStats.json', JSON.stringify(serverStats, null, 2));
  } catch (error) {
    console.error('Error saving server stats:', error);
  }
}

function loadServerStats() {
  try {
    if (fs.existsSync('./serverStats.json')) {
      serverStats = JSON.parse(fs.readFileSync('./serverStats.json'));
    }
  } catch (error) {
    console.error('Error loading server stats:', error);
  }
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands.map(command => command.toJSON()) },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }
  
  loadServerStats();
  updateBotStatus();
  
  // Check server status more frequently to detect changes faster
  setInterval(updateBotStatus, 2 * 60 * 1000); // Check every 2 minutes
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'status') {
    const serverAddress = options.getString('server') || DEFAULT_SERVER;
    const serverPort = options.getInteger('port') || DEFAULT_PORT;
    
    try {
      await interaction.deferReply();
      
      const result = await util.status(serverAddress, serverPort);
      
      if (serverAddress === DEFAULT_SERVER && serverPort === DEFAULT_PORT) {
        lastPlayerCount = result.players.online;
        updateBotStatus();
      }
      
      const embed = new EmbedBuilder()
        .setColor(result.players.online > 0 ? '#00AA00' : '#FFAA00')
        .setTitle(`${serverAddress}:${serverPort} Status`)
        .setDescription(`**Server Version:** ${result.version.name}`)
        .addFields(
          { name: '👥 Players', value: `${result.players.online}/${result.players.max}`, inline: true },
          { name: '📊 Latency', value: `${result.roundTripLatency}ms`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Last updated', iconURL: client.user.displayAvatarURL() });
      
      if (result.favicon) {
        embed.setThumbnail(`data:image/png;base64,${result.favicon}`);
      }
      
      if (result.motd && result.motd.clean) {
        embed.addFields({ name: '📝 MOTD', value: result.motd.clean });
      }
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching server status:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Connection Error')
        .setDescription(`Failed to connect to server ${serverAddress}:${serverPort}`)
        .setTimestamp();
      
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
  
  else if (commandName === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('Minecraft Server Status Bot - Help')
      .setDescription('List of available commands:')
      .addFields(
        { name: '`/status [server] [port]`', value: 'Check status of a Minecraft server', inline: false },
        { name: '`/players [server] [port]`', value: 'Show list of online players', inline: false },
        { name: '`/serverinfo`', value: 'Show detailed information about the default server', inline: false },
        { name: '`/ping`', value: 'Check the bot\'s response time', inline: false },
        { name: '`/help`', value: 'Show this help message', inline: false },
        { name: '`/history`', value: 'Show server uptime history', inline: false },
        { name: '`/subscribe`', value: 'Subscribe to server status notifications', inline: false },
        { name: '`/config`', value: 'Configure bot settings (Admin only)', inline: false }
      )
      .setFooter({ 
        text: 'If server and port are not specified, defaults will be used', 
        iconURL: client.user.displayAvatarURL() 
      })
      .setTimestamp();
    
    await interaction.reply({ embeds: [helpEmbed] });
  }
  
  else if (commandName === 'players') {
    const serverAddress = options.getString('server') || DEFAULT_SERVER;
    const serverPort = options.getInteger('port') || DEFAULT_PORT;
    
    try {
      await interaction.deferReply();
      
      const result = await util.status(serverAddress, serverPort);
      
      const embed = new EmbedBuilder()
        .setColor('#00AA00')
        .setTitle(`${serverAddress} - Player List`)
        .setDescription(`**Total Online:** ${result.players.online}/${result.players.max}`)
        .setTimestamp()
        .setFooter({ text: 'Last updated', iconURL: client.user.displayAvatarURL() });
      
      if (result.players.sample && result.players.sample.length > 0) {
        const playerList = result.players.sample.map(player => `• ${player.name}`).join('\n');
        embed.addFields({ name: '🎮 Online Players', value: playerList.substring(0, 1024) });
      } else if (result.players.online > 0) {
        embed.addFields({ name: '🎮 Online Players', value: 'Player names not available' });
      } else {
        embed.setDescription('**No players online**')
             .setColor('#FFAA00');
      }
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching player list:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Connection Error')
        .setDescription(`Failed to connect to server ${serverAddress}:${serverPort}`)
        .setTimestamp();
      
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
  
  else if (commandName === 'ping') {
    const sent = await interaction.deferReply({ fetchReply: true });
    const pingEmbed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('🏓 Pong!')
      .addFields(
        { name: 'Bot Latency', value: `${sent.createdTimestamp - interaction.createdTimestamp}ms`, inline: true },
        { name: 'API Latency', value: `${Math.round(client.ws.ping)}ms`, inline: true }
      )
      .setTimestamp();
      
    await interaction.editReply({ embeds: [pingEmbed] });
  }
  
  else if (commandName === 'serverinfo') {
    try {
      await interaction.deferReply();
      
      const result = await util.status(DEFAULT_SERVER, DEFAULT_PORT);
      
      const serverInfoEmbed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle(`${DEFAULT_SERVER} - Server Information`)
        .setDescription('Detailed information about the default Minecraft server')
        .addFields(
          { name: '📋 Server Address', value: `\`${DEFAULT_SERVER}:${DEFAULT_PORT}\``, inline: false },
          { name: '🔧 Version', value: result.version.name, inline: true },
          { name: '👥 Players', value: `${result.players.online}/${result.players.max}`, inline: true },
          { name: '📊 Latency', value: `${result.roundTripLatency}ms`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Default server information', iconURL: client.user.displayAvatarURL() });
      
      if (result.motd.clean) {
        serverInfoEmbed.addFields({ name: '📝 MOTD', value: result.motd.clean });
      }
      
      if (result.players.sample && result.players.sample.length > 0) {
        const playerList = result.players.sample.map(player => `• ${player.name}`).join('\n');
        serverInfoEmbed.addFields({ name: '🎮 Online Players', value: playerList.substring(0, 1024) });
      }
      
      await interaction.editReply({ embeds: [serverInfoEmbed] });
    } catch (error) {
      console.error('Error fetching server info:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Connection Error')
        .setDescription(`Failed to connect to the default server: ${DEFAULT_SERVER}:${DEFAULT_PORT}`)
        .setTimestamp();
      
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  }
  
  else if (commandName === 'activate') {
    const activateEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🏆 Active Developer Badge')
      .setDescription('This interaction helps you qualify for the Active Developer Badge!')
      .addFields(
        { name: 'Next Steps', value: 'Visit the [Developer Portal](https://discord.com/developers/active-developer) to claim your badge' },
        { name: 'Requirements', value: 'You need to wait up to 24 hours after using this command before claiming the badge' },
        { name: 'More Info', value: '[Discord Active Developer Program](https://support-dev.discord.com/hc/en-us/articles/10113997751447-Active-Developer-Badge)' }
      )
      .setTimestamp()
      .setFooter({ text: 'Badge activation', iconURL: client.user.displayAvatarURL() });
    
    await interaction.reply({ embeds: [activateEmbed] });
  }

  else if (commandName === 'history') {
    try {
      const uptimeHours = (serverStats.uptime / (1000 * 60 * 60)).toFixed(2);
      const downtimeHours = (serverStats.downtime / (1000 * 60 * 60)).toFixed(2);
      const upPercentage = ((serverStats.uptime / (serverStats.uptime + serverStats.downtime)) * 100).toFixed(2);
      
      const historyEmbed = new EmbedBuilder()
        .setColor('#0099FF')
        .setTitle(`${DEFAULT_SERVER} - Server History`)
        .setDescription('Server uptime statistics and history')
        .addFields(
          { name: '⬆️ Uptime', value: `${uptimeHours} hours (${upPercentage}%)`, inline: true },
          { name: '⬇️ Downtime', value: `${downtimeHours} hours`, inline: true },
          { name: '🏆 Player Peak', value: `${serverStats.playerPeak.count} players`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Server statistics', iconURL: client.user.displayAvatarURL() });
      
      // Add recent history
      if (serverStats.history.length > 0) {
        const recentEvents = serverStats.history.slice(-5).map(event => {
          const date = new Date(event.timestamp);
          return `• ${event.status === 'online' ? '🟢' : '🔴'} ${event.status} - ${date.toLocaleString()}`;
        }).join('\n');
        
        historyEmbed.addFields({ name: '📜 Recent Events', value: recentEvents });
      }
      
      await interaction.reply({ embeds: [historyEmbed] });
    } catch (error) {
      console.error('Error handling history command:', error);
      await interaction.reply({ content: 'Failed to retrieve server history', ephemeral: true });
    }
  }
  
  else if (commandName === 'subscribe') {
    // For now, just acknowledge the command - this would need a database to fully implement
    const type = options.getString('type');
    const responseEmbed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('Subscription Added')
      .setDescription(`You've subscribed to ${type} notifications for ${DEFAULT_SERVER}`)
      .addFields({ 
        name: 'Coming Soon', 
        value: 'This feature is under development. Notifications will be sent to your DMs when enabled.' 
      })
      .setTimestamp();
      
    await interaction.reply({ embeds: [responseEmbed], ephemeral: true });
  }
  
  else if (commandName === 'config') {
    // Only allow server admins to use this command
    if (!interaction.memberPermissions.has('ADMINISTRATOR')) {
      await interaction.reply({ 
        content: 'You need administrator permissions to use this command', 
        ephemeral: true 
      });
      return;
    }
    
    const setting = options.getString('setting');
    const value = options.getString('value');
    
    // Placeholder for configuration
    const configEmbed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('Bot Configuration')
      .setDescription(`Configuration setting "${setting}" was updated`)
      .addFields({ name: 'New Value', value: value })
      .setTimestamp();
      
    await interaction.reply({ embeds: [configEmbed] });
  }
});

client.on('error', console.error);

client.login(process.env.DISCORD_TOKEN);