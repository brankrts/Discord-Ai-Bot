const express = require("express");
const axios = require("axios");
const Jimp = require("jimp");
const sharp = require("sharp");
const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
} = require("discord.js");

const { Groq } = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});
const app = express();
const PORT = process.env.PORT || 3000;

function configure() {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });

  client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`);
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === "prompt") {
      const promptText = interaction.options.getString("input");

      try {
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: "user",
              content: promptText,
            },
          ],
          model: "gemma2-9b-it",
        });

        let response =
          chatCompletion.choices[0]?.message?.content || "Bir hata oluştu.";

        const maxTotalLength = 2000;

        if (!interaction.replied) {
          await interaction.reply({
            content: `${interaction.user} Istegi -> ${promptText}`,
            ephemeral: false,
          });
        }

        let remainingResponse = response;

        while (remainingResponse.length > 0) {
          let allowedLength = maxTotalLength - promptText.length;

          let partSize = Math.min(remainingResponse.length, allowedLength);

          let responsePart = remainingResponse.substring(0, partSize);
          remainingResponse = remainingResponse.substring(partSize);

          if (!interaction.replied) {
            await interaction.reply({
              content: `${interaction.user} ${responsePart}`,
              ephemeral: false,
            });
          } else {
            await interaction.followUp({
              content: `${interaction.user} ${responsePart}`,
              ephemeral: false,
            });
          }
        }
      } catch (error) {
        console.error("Error:", error);
        await interaction.reply({
          content: "API isteği sırasında bir hata oluştu.",
          ephemeral: true,
        });
      }
    }
    if (interaction.commandName == "image") {
      const promptText = interaction.options.getString("input");
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
        promptText
      )}`;
      try {
        await interaction.reply("Uzerinde calisiyorum...");
        const response = await axios.get(imageUrl, {
          responseType: "arraybuffer",
        });

        const buffer = Buffer.from(response.data, "binary");

        const image = await Jimp.Jimp.read(buffer);
        const width = image.bitmap.width;
        const height = image.bitmap.height;

        const imageBuffer = await sharp(buffer)
          .extract({ left: 0, top: 0, width: width, height: height - 46 })
          .toBuffer();

        await interaction.editReply({
          content: `Bu prompt icin resim olusturuldu: ${promptText}`,
          files: [
            {
              attachment: imageBuffer,
              name: "generated-image.png",
            },
          ],
        });
      } catch (error) {
        console.error("Error fetching the image:", error);
        await interaction.reply({
          content: "Sorry, something went wrong while fetching the image.",
          ephemeral: true,
        });
      }
    }
  });

  client.on("ready", async () => {
    const guildId = process.env.CHANNEL_ID;
    const guild = client.guilds.cache.get(guildId);

    const commandData = new SlashCommandBuilder()
      .setName("prompt")
      .setDescription("Bir prompt göndererek yanıt al.")
      .addStringOption((option) =>
        option
          .setName("input")
          .setDescription("Gönderilecek prompt")
          .setRequired(true)
      );
    const commandImageData = new SlashCommandBuilder()
      .setName("image")
      .setDescription("Bir prompt göndererek resim ciktisi al.")
      .addStringOption((option) =>
        option
          .setName("input")
          .setDescription("Gönderilecek prompt")
          .setRequired(true)
      );

    if (guild) {
      await guild.commands.create(commandData);
      await guild.commands.create(commandImageData);
      console.log("Komut kaydedildi.");
    }
  });

  client.login(process.env.DISCORD_TOKEN);
}

app.get("/", (req, res) => {
  res.send("Hello from Discord bot");
});

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor.`);
  try {
    configure();
  } catch (error) {
    console.log(error);
    configure();
  }
});
