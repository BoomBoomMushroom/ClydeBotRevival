// Invite: discord.com/oauth2/authorize?client_id=1331074135467491328&permissions=377957162048&scope=bot%20applications.commands

const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { token, clientId, geminiToken, defaultSystemInstructions, TextMemoryLength } = require('./config.json');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
let settings = require("./settings.json");

const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    }
];
const geminiAI = new GoogleGenerativeAI(geminiToken);

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages] });

client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

async function writeSettings(settings){
    let content = JSON.stringify(settings)
    fs.writeFile('./settings.json', content, err => {
        if (err) {
            console.error(err);
        } else {
            // file written successfully
        }
    });
}

async function getGeminiResponse(message, imageAttachments) {
    let systemInstruction = defaultSystemInstructions + "\n" + settings["SystemInstructionAddon"]

    const model = geminiAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: systemInstruction,
        safetySettings: safetySettings,
    });
    
    const generationConfig = {
        temperature: 1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: "text/plain",
    };

    const chatSession = model.startChat({
        generationConfig,
        history: settings["ChatHistory"],
    });

    imageAttachments.push(message)
    console.log(imageAttachments)
    const result = await chatSession.sendMessage(imageAttachments);
    let responseText = result.response.text()

    responseText = responseText.slice(0, 1800) // max chars (from discord)

    settings["ChatHistory"].push({"role": "user", "parts": [{"text": message}]})
    settings["ChatHistory"].push({"role": "model", "parts": [{"text": responseText}]})
    let cutDownHistory = settings["ChatHistory"].slice( -(TextMemoryLength*2) )
    settings["ChatHistory"] = cutDownHistory
    writeSettings(settings)

    return responseText
}

client.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
		}
	}
});

client.on(Events.MessageCreate, async message => {
    if(message.author.bot){ return; }
    let userMentions = message.mentions.users
    let messageContent = message.content
    let iAmMentioned = false

    userMentions.forEach((user)=>{
        if (user.id == clientId){
            //console.log("I'm mentioned!")
            iAmMentioned = true
            // messageContent.replace("<@" + clientId + ">", "")
        }
        let userAt = "<@" + user.id + ">"
        messageContent = messageContent.replace(userAt, `@${user.username} / @${user.globalName} (${userAt})`)
        //console.log(user)
    })
    if(iAmMentioned == false){
        return;
    }

    console.log(message)

    let attachments = []
    let messageAttachments = message.attachments.toJSON()
    for(let i=0; i<messageAttachments.length; i++){
        let attachment = messageAttachments[i]
        if(attachment.contentType.startsWith("image") == false){ continue }
        
        let imgData = await fetch(attachment.url)
        .then((response)=>response.arrayBuffer());
        
        attachments.push({
            inlineData: {
                data: Buffer.from(imgData).toString("base64"),
                mimeType: attachment.contentType,
            }
        })
    }
    
    let messageToSendAI = message.author.username + ": " + messageContent

    let hasRef = message.reference != null
    if(hasRef){
        let referenceMessage = await message.fetchReference()
        let refContent = referenceMessage.content
        let refUsername = referenceMessage.author.username
        let usernameInput = `@${referenceMessage.author.username} / @${referenceMessage.author.globalName} (${referenceMessage.author.id})`

        messageToSendAI = `Message being replied to: \`\`\`${usernameInput}: ${refContent}\`\`\`\n` + messageToSendAI

        //console.log(referenceMessage)
    }

    let response = await getGeminiResponse(messageToSendAI, attachments)
    
    console.log("Message Content: " + messageToSendAI)
    console.log("Message Response: " + response)

    message.reply({"content": response})
});

// Log in to Discord with your client's token
client.login(token);