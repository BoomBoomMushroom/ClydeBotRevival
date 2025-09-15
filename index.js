// Invite: discord.com/oauth2/authorize?client_id=1331074135467491328&permissions=377957162048&scope=bot%20applications.commands

const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { token, clientId, geminiToken, geminiModel, defaultSystemInstructions, TextMemoryLength,
    ADMIN_USERIDs, THEO_USERID
 } = require('./config.json');
const { GoogleGenAI, HarmCategory, HarmBlockThreshold } = require("@google/genai");
const { Type } = require("@google/genai");

let settings = require("./settings.json");

const geminiTools = [
    { urlContext: {} },
];
const geminiToolsFunctionsOnly = [
    {
        functionDeclarations: [
            {
                name: 'ChangeNickname',
                description: 'Changes the username of the person given',
                parameters: {
                type: Type.OBJECT,
                required: ["NewUsername", "UserID"],
                properties: {
                        NewUsername: { type: Type.STRING, },
                        UserID: { type: Type.STRING, },
                    },
                },
            },
        ],
    }
]
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
const geminiAI = new GoogleGenAI({apiKey: geminiToken});

// Create a new client instance
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers,
    ]
});

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
    let content = JSON.stringify(settings, null, 4)
    fs.writeFile('./settings.json', content, err => {
        if (err) {
            console.error(err);
        } else {
            // file written successfully
        }
    });
}

async function generateGeminiResponseWithContent(contents, generationConfig, guildId){
    let response = await geminiAI.models.generateContentStream({
        model: geminiModel,
        config: generationConfig,
        contents: contents,
    })
    
    let responseText = ""
    try{
        for await (const chunk of response) {
            console.log(chunk.functionCalls ? chunk.functionCalls[0] : chunk.text)
            if(chunk.functionCalls){
                let functionCall = chunk.functionCalls[0]
                if(functionCall.name == "ChangeNickname"){
                    let newUsername = functionCall.args.NewUsername
                    let userIdToChange = functionCall.args.UserID
                    let returnVal = await changeNickname(newUsername, userIdToChange, guildId)
                    if(returnVal != true){ // an error occurred lets put that in clyde's response
                        responseText += "\nChangeNickname('"+newUsername+"', '"+userIdToChange+"', "+guildId+")\n\t-> "+returnVal+"\n"
                    }
                    else{ returnVal = "Successfully changed nickname! You can stop calling this function now" }
                    
                    console.log(returnVal);
                    let functionResponsePart = {
                        name: functionCall.name,
                        response: { returnVal }
                    }
                    contents.push({"role": "user", "parts": [{functionResponse: functionResponsePart}]})
                    
                    generationConfig["tools"] = geminiTools
                    responseText += await generateGeminiResponseWithContent(contents, generationConfig, guildId);
                }
            }
            else{
                let part = chunk.text
                responseText += part
            }
        }
    } catch(e){
        console.error(e)
        responseText = "I think Google Gemini has blocked this response D:\nHere is the error ```"+e+"```"
        //responseText = "Google Gemini has blocked this response >:C"
    }

    return responseText;
}

async function determineIfNeedUseTools(guildId, message){
    if(guildId in settings){}
    else{
        settings[guildId] = {"SystemInstructionAddon": "", "ChatHistory": []}
    }
    
    let systemInstruction = defaultSystemInstructions + "\n" + settings[guildId]["SystemInstructionAddon"]
    systemInstruction += "\n\nSearching the internet and url context are not function tools. only return true if you would call one of these functions, internet searhcing and url context doens't count"
    const config = {
        maxOutputTokens: 1024,
        thinkingConfig: {
            thinkingBudget: 0,
        },
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.OBJECT,
            required: ["reasonableToCallTools"],
            properties: {
                reasonableToCallTools: {
                type: Type.BOOLEAN,
                },
            },
        },
        systemInstruction: [{text: systemInstruction}]
    };
    message += "\n\nTools available:"
    for(let i=0; i<geminiToolsFunctionsOnly[0].functionDeclarations.length; i++){
        let functionTool = geminiToolsFunctionsOnly[0].functionDeclarations[i]
        message += "\nName: " + functionTool.name + " | Desc: " + functionTool.description + "Required Vars: " + functionTool.required
    }
    
    const contents = [
        {
            role: 'user',
            parts: [ { text: message } ],
        },
    ];
    const response = await geminiAI.models.generateContentStream({
        model: geminiModel,
        config: config,
        contents: contents,
    });
    out = ""
    for await (const chunk of response) {
        out += chunk.text;
    }
    return JSON.parse(out).reasonableToCallTools
}

async function getGeminiResponse(guildId, message, imageAttachments) {
    if(guildId in settings){}
    else{
        settings[guildId] = {"SystemInstructionAddon": "", "ChatHistory": []}
    }

    let shouldOnlyUseFunctionTools = await determineIfNeedUseTools(guildId, message)
    
    let systemInstruction = defaultSystemInstructions + "\n" + settings[guildId]["SystemInstructionAddon"]
    const generationConfig = {
        temperature: 1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: "text/plain",
        safetySettings: safetySettings,
        systemInstruction: [
            {"text": systemInstruction}
        ],
        tools: (shouldOnlyUseFunctionTools ? geminiToolsFunctionsOnly : geminiTools), // switches to the geminiTools again after a function tool is used in generateGeminiResponseWithContent
    };

    var contents = settings[guildId]["ChatHistory"]
    var messageParts = []
    messageParts.push(...imageAttachments)
    messageParts.push({"text": message})
    contents.push({"role": "user", "parts": messageParts})
    //console.log(imageAttachments)

    let responseText = await generateGeminiResponseWithContent(contents, generationConfig, guildId)
    responseText = responseText.slice(0, 1800) // max chars (from discord)

    settings[guildId]["ChatHistory"].push({"role": "user", "parts": [{"text": message}]})
    settings[guildId]["ChatHistory"].push({"role": "model", "parts": [{"text": responseText}]})
    let cutDownHistory = settings[guildId]["ChatHistory"].slice( -(TextMemoryLength*2) )
    settings[guildId]["ChatHistory"] = cutDownHistory
    writeSettings(settings)

    return responseText
}

async function changeNickname(newUsername, userId, guildId) {
    console.log("Changing username of " + userId + " to " + newUsername + " in guildId " +guildId);
    try{
        let guild = await client.guilds.cache.get(guildId);
        console.log(guild)
        let guildUser = await guild.members.fetch(userId.toString());
        console.log(guildUser)
        await guildUser.setNickname(newUsername, "Clyde called a command to change the username")
        return true
    }
    catch(e){
        console.error(e)
        return "Error! " + e
    }
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

    if(message.author.id == THEO_USERID && settings[message.guildId]["IgnoreTheo"]==true){
        try{
            message.reply({"content": "I will not reply to you Theo"});
        }catch{}
        return
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
    
    let messageUserPrefix = `${message.author.globalName} / ${message.author.displayName} / ${message.author.id}`
    let messageToSendAI = messageUserPrefix + ": " + messageContent

    let hasRef = message.reference != null
    if(hasRef){
        let referenceMessage = await message.fetchReference()
        let refContent = referenceMessage.content
        let usernameInput = `${referenceMessage.author.globalName} / ${referenceMessage.author.displayName} /  (${referenceMessage.author.id})`

        messageToSendAI = `Message being replied to: \`\`\`${usernameInput}: ${refContent}\`\`\`\n` + messageToSendAI

        //console.log(referenceMessage)
    }

    let guildId = message.guildId
    let response = await getGeminiResponse(guildId, messageToSendAI, attachments)
    
    console.log("Message Content: " + messageToSendAI)
    console.log("Message Response: " + response)

    try{
        message.reply({"content": response})
    } catch {}
});

// Log in to Discord with your client's token
client.login(token);