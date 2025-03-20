const { Client, GatewayIntentBits, EmbedBuilder, ActivityType, REST, Routes, SlashCommandBuilder } = require('discord.js');
const util = require('minecraft-server-util');
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
    .setDescription('Helps you qualify for the Active Developer badge')
];

async function updateBotStatus() {
  try {
    const result = await util.status(DEFAULT_SERVER, DEFAULT_PORT);
    lastPlayerCount = result.players.online;
    
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
        embed.setThumbnail(`attachment://favicon.png`);
      }
      
      if (result.players.sample && result.players.sample.length > 0) {
        const playerList = result.players.sample.map(player => `• ${player.name}`).join('\n');
        embed.addFields({ name: '🎮 Online Players', value: playerList.substring(0, 1024) });
      }
      
      if (result.motd.clean) {
        embed.addFields({ name: '📝 MOTD', value: result.motd.clean });
      }
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching server status:', error);
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ Connection Error')
        .setDescription(`Failed to connect to server ${serverAddress}:${serverPort}`)
        .addFields({ name: 'Error Details', value: 'Make sure the server is online and the address is correct.' })
        .setTimestamp();
      
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  } 
  
  else if (commandName === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('Minecraft Server Status Bot')
      .setDescription('This bot helps you monitor your Minecraft server status and player count')
      .addFields(
        { name: '`/status [server] [port]`', value: 'Check the status of a Minecraft server', inline: false },
        { name: '`/players [server] [port]`', value: 'Show list of online players', inline: false },
        { name: '`/serverinfo`', value: 'Show detailed information about the default server', inline: false },
        { name: '`/ping`', value: 'Check the bot\'s response time', inline: false },
        { name: '`/help`', value: 'Show this help message', inline: false }
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
});

client.on('error', console.error);

client.login(process.env.DISCORD_TOKEN);