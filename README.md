# Minecraft Server Discord Bot

A Discord bot that monitors and displays information about Minecraft servers, with a focus on server status, player count, and uptime tracking.

## Features

- 🔄 Real-time Minecraft server status monitoring
- 👥 Player count tracking and display
- 📊 Server uptime/downtime statistics
- 🔔 Automatic notifications when server status changes
- 📝 Detailed server information display
- 📈 Player peak tracking
- 🛠️ Configurable update intervals and settings

## Setup

### Prerequisites

- Node.js (v14+)
- A Discord Bot Token
- A Minecraft server to monitor

### Installation

1. Clone this repository
2. Install dependencies:
```bash
npm install
```
3. Configure your environment variables by editing the `.env` file:
```
DISCORD_TOKEN=your_discord_bot_token
```
4. Configure the bot settings in `config.js`:
```js
module.exports = {
  defaultServer: 'your.minecraft-server.com',
  defaultPort: 25565,
  statusUpdateInterval: 2 * 60 * 1000,
  statusChannelId: 'your_discord_channel_id',
  embedColor: {
    online: '#00AA00',
    offline: '#FF0000',
    warning: '#FFAA00',
    info: '#0099FF'
  }
};
```
5. Start the bot:
```bash
node index.js
```

## Commands

| Command | Description | Options |
|---------|-------------|---------|
| `/status` | Check the status of a Minecraft server | `server` (optional), `port` (optional) |
| `/players` | Show online players on the server | `server` (optional), `port` (optional) |
| `/serverinfo` | Show detailed information about the default server | None |
| `/history` | Show server uptime history and statistics | None |
| `/ping` | Check the bot's latency and API response time | None |
| `/help` | Show help information about the bot commands | None |
| `/subscribe` | Subscribe to server status notifications | `type` (all/status/players) |
| `/config` | Configure bot settings (Admin only) | `setting`, `value` |
| `/activate` | Helps you qualify for the Active Developer badge | None |

## Stats Tracking

The bot automatically tracks:
- Server uptime and downtime
- Status change history
- Maximum player count
- Player peak information

## Configuration Options

Edit the `config.js` file to customize:
- Default Minecraft server address and port
- Status update frequency
- Discord channel for automatic notifications
- Embed colors for different server states

## License

This project is open-source. Feel free to modify and use it for your own Discord communities.

## Acknowledgements

- [discord.js](https://discord.js.org/) - Discord API wrapper
- [minecraft-server-util](https://github.com/PassTheMayo/minecraft-server-util) - Minecraft server status utility