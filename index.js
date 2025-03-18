const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const util = require('minecraft-server-util');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Configuration
const PREFIX = '!mc';
const DEFAULT_SERVER = 'play.uduality.site';
const DEFAULT_PORT = 19231; 
let lastPlayerCount = 0;

// Function to update bot's status with player count
async function updateBotStatus() {
  try {
    const result = await util.status(DEFAULT_SERVER, DEFAULT_PORT);
    lastPlayerCount = result.players.online;
    
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
    client.user.setPresence({
      activities: [{
        name: `${DEFAULT_SERVER} | Server offline`,
        type: ActivityType.Watching
      }],
      status: 'dnd' // Red status when server is down
    });
  }
}

// Ready event
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  // Set initial status
  updateBotStatus();
  
  // Update status every 5 minutes
  setInterval(updateBotStatus, 5 * 60 * 1000);
});

// Message event
client.on('messageCreate', async message => {
  // Ignore messages from bots or messages that don't start with the prefix
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;
  
  // Parse the command
  const args = message.content.slice(PREFIX.length).trim().split(' ');
  const command = args.shift().toLowerCase();
  
  // Handle commands
  if (command === 'status' || command === 'players') {
    // Get server address and port from arguments or use defaults
    const serverAddress = args[0] || DEFAULT_SERVER;
    const serverPort = parseInt(args[1]) || DEFAULT_PORT;
    
    try {
      // Send a typing indicator while fetching data
      await message.channel.sendTyping();
      
      // Get server status
      const result = await util.status(serverAddress, serverPort);
      
      // If checking the default server, update the lastPlayerCount
      if (serverAddress === DEFAULT_SERVER && serverPort === DEFAULT_PORT) {
        lastPlayerCount = result.players.online;
        updateBotStatus();
      }
      
      // Create an embed with server information
      const embed = new EmbedBuilder()
        .setColor('#00AA00')
        .setTitle(`${serverAddress}:${serverPort} Status`)
        .setDescription(`**Server Version:** ${result.version.name}`)
        .addFields(
          { name: 'Players', value: `${result.players.online}/${result.players.max}`, inline: true },
          { name: 'Latency', value: `${result.roundTripLatency}ms`, inline: true }
        )
        .setTimestamp();
      
      // Add player list if available
      if (result.players.sample && result.players.sample.length > 0) {
        const playerList = result.players.sample.map(player => player.name).join(', ');
        embed.addFields({ name: 'Online Players', value: playerList });
      }
      
      // Add MOTD (message of the day) if available
      if (result.motd.clean) {
        embed.addFields({ name: 'MOTD', value: result.motd.clean });
      }
      
      // Send the embed
      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching server status:', error);
      await message.reply(`Error connecting to server ${serverAddress}:${serverPort}. Make sure the server is online and the address is correct.`);
    }
  } else if (command === 'help') {
    // Help command
    const helpEmbed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('Minecraft Server Status Bot Commands')
      .addFields(
        { name: `${PREFIX} status [server] [port]`, value: 'Check the status of a Minecraft server' },
        { name: `${PREFIX} players [server] [port]`, value: 'Check how many players are online (alias for status)' },
        { name: `${PREFIX} help`, value: 'Show this help message' }
      )
      .setFooter({ text: 'If server and port are not specified, defaults will be used' });
    
    await message.reply({ embeds: [helpEmbed] });
  }
});

// Error handling
client.on('error', console.error);

// Login to Discord with your bot token
client.login(process.env.DISCORD_TOKEN);