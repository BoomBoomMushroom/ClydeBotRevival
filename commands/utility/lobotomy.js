const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('lobotomy')
		.setDescription('Makes Clyde forget all of his chat messages'),
	async execute(interaction) {
        let settings = require("../../settings.json");
        settings["ChatHistory"] = []
        let content = JSON.stringify(settings)
        fs.writeFile('../../settings.json', content, async err => {
            if (err) {
                console.error(err);
                await interaction.reply("Error! Nothing has changed! " + err);
            } else {
                // file written successfully
                await interaction.reply({content: "I've been lobotomized :C", tts: true });
            }
        });

	},

};