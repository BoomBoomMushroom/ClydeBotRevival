const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('getprompt')
		.setDescription('Gets the internal prompt of Clyde'),
	async execute(interaction) {
		let guildId = interaction.guildId
		let settings =require("../../settings.json")
		if(guildId in settings){
			let systemInstructions = settings[guildId]["SystemInstructionAddon"];
			await interaction.reply("Here are the system instructions: ```" + systemInstructions + "```")
		}
		else{
			await interaction.reply("This server has no system instructions set up! Use `/setprompt` to add one")
		}
	},
};