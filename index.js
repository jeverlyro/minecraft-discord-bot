const { Client, GatewayIntentBits, EmbedBuilder, ActivityType, REST, Routes, SlashCommandBuilder } = require('discord.js');
const util = require('minecraft-server-util');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

// Configuration
const DEFAULT_SERVER = 'play.uduality.site';
const DEFAULT_PORT = 19231; 
let lastPlayerCount = 0;

// Define slash commands
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
    .setDescription('Show help information about the bot commands')
];

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
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  // Register slash commands
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
  
  // Set initial status
  updateBotStatus();
  
  // Update status every 5 minutes
  setInterval(updateBotStatus, 5 * 60 * 1000);
});

// Interaction handler for slash commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'status') {
    // Get server address and port from options or use defaults
    const serverAddress = options.getString('server') || DEFAULT_SERVER;
    const serverPort = options.getInteger('port') || DEFAULT_PORT;
    
    try {
      // Defer reply as this might take a moment
      await interaction.deferReply();
      
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
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching server status:', error);
      await interaction.editReply(`Error connecting to server ${serverAddress}:${serverPort}. Make sure the server is online and the address is correct.`);
    }
  } else if (commandName === 'help') {
    // Help command
    const helpEmbed = new EmbedBuilder()
      .setColor('#0099FF')
      .setTitle('Minecraft Server Status Bot Commands')
      .addFields(
        { name: `/status [server] [port]`, value: 'Check the status of a Minecraft server' },
        { name: `/help`, value: 'Show this help message' }
      )
      .setFooter({ text: 'If server and port are not specified, defaults will be used' });
    
    await interaction.reply({ embeds: [helpEmbed] });
  }
});

// Error handling
client.on('error', console.error);

// Login to Discord with your bot token
client.login(process.env.DISCORD_TOKEN);