const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require("node:path");

let configPath = path.resolve(__dirname, "../../config.json")
const { ADMIN_USERIDs } = require(configPath);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ignoretheo')
		.setDescription('Make clyde listen to or ignores Theo (Will never respond to him)')
        .addBooleanOption(option => 
            option.setName('ignore')
            .setDescription('True for ignoring Theo, False for listening to Theo')
            .setRequired(true)
        ),
	async execute(interaction) {
        let doIgnoreTheo = interaction.options.getBoolean('ignore') ?? false;
        console.log("Ignore Theo? " + doIgnoreTheo);

        let commandRunnerId = interaction.user.id.toString()
        let isAuthorized = false
        console.log(interaction)
        console.log(ADMIN_USERIDs, commandRunnerId)
        for(let i=0; i<ADMIN_USERIDs.length; i++){
            if(ADMIN_USERIDs[i] == commandRunnerId){
                isAuthorized = true; break
            }
        }

        if(isAuthorized){
            console.log("Admin used command! " + interaction.user.username)
        }
        else{
            interaction.reply("You're not authorized to use this command")
            return;
        }

        let settingsPath = path.resolve(__dirname, "../../settings.json")
        let settings = require(settingsPath);
        let guildId = interaction.guildId

        if(guildId in settings){}
        else{
            settings[guildId] = {"SystemInstructionAddon": "", "ChatHistory": [], "IgnoreTheo": false}
        }

        settings[guildId]["IgnoreTheo"] = doIgnoreTheo
        let content = JSON.stringify(settings, null, 4)
        fs.writeFile(settingsPath, content, async err => {
            if (err) {
                console.error(err);
                try{
                    await interaction.reply("Error! Nothing has changed! " + err);
                }catch{}
            } else {
                // file written successfully
                try{
                    let msg = 'Successfully made Theo ignored.'
                    if(doIgnoreTheo==false){ msg = 'Successfully made Theo NOT ignored.' }
                    await interaction.reply(msg);
                }catch{}
            }
        });

	},

};