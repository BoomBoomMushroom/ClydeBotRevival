const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('getprompt')
		.setDescription('Gets the internal prompt of Clyde'),
	async execute(interaction) {
        let systemInstructions = require("../../settings.json")["SystemInstructionAddon"];
        await interaction.reply("Here are the system instructions: ```" + systemInstructions + "```")
	},
};