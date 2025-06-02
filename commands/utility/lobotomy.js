const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('lobotomy')
		.setDescription('Makes Clyde forget all of his chat messages'),
	async execute(interaction) {
        let guildId = interaction.guildId
        let settingsPath = path.resolve(__dirname, "../../settings.json")
        let settings = require(settingsPath);
        if(guildId in settings){}
        else{
            await interaction.reply("I have no memories already!");
            return
        }

        settings[guildId]["ChatHistory"] = []
        let content = JSON.stringify(settings, null, 4)
        fs.writeFile(settingsPath, content, async err => {
            if (err) {
                console.error(err);
                await interaction.reply("Error! Nothing has changed! " + err);
            } else {
                // file written successfully
                await interaction.reply({content: "I've been lobotomized :C", tts: false });
            }
        });

	},

};