const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setprompt')
		.setDescription('Sets the internal prompt of Clyde')
        .addStringOption(option => 
            option.setName('instructions')
            .setDescription('What the internal prompt of Clyde will be')
            .setRequired(true)
        ),
	async execute(interaction) {
        let newInstructions = interaction.options.getString('instructions') ?? null;
        console.log("instructs: " + newInstructions)
        if(newInstructions == null){
            await interaction.reply('No prompt supplied! Nothing has changed!');
            return;
        }
        console.log("Do something with the prompt");

        let settings = require("../../settings.json");
        settings["SystemInstructionAddon"] = newInstructions
        let content = JSON.stringify(settings)
        fs.writeFile('../../settings.json', content, async err => {
            if (err) {
                console.error(err);
                await interaction.reply("Error! Nothing has changed! " + err);
            } else {
                // file written successfully
                await interaction.reply('Successfully set the system instructions to: ```'+ newInstructions +'```');
            }
        });

	},

};