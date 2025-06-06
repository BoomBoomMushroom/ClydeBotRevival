const { SlashCommandBuilder } = require('discord.js');
const path = require("node:path");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('getprompt')
		.setDescription('Gets the internal prompt of Clyde'),
	async execute(interaction) {
		let guildId = interaction.guildId
        let settingsPath = path.resolve(__dirname, "../../settings.json")
		let settings = require(settingsPath)
		if(guildId in settings){
			let systemInstructions = settings[guildId]["SystemInstructionAddon"];
			await interaction.reply("Here are the system instructions: ```" + systemInstructions + "```")
		}
		else{
			await interaction.reply("This server has no system instructions set up! Use `/setprompt` to add one")
		}
	},
};