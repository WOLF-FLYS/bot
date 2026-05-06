const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    downloadMediaMessage
} = require("@whiskeysockets/baileys");

const qrcode = require("qrcode-terminal");
const fs = require("fs");
const { exec } = require("child_process");
const ytdlp = require("yt-dlp-exec");
const axios = require("axios");

// ===== CONFIG =====
const OWNER_NUMBER = "558781319168";
const OWNER_LID = "14551919652934";
const COMMAND_PREFIX = "☆";

// ===== SISTEMA =====
let adminsBot = [];
let banY = {};
let banF = {};

// ===== FUNÇÕES AUXILIARES =====
function getPureNumber(id) {
    return id?.replace(/[^0-9]/g, "") || "";
}

function getSender(msg) {
    return msg.key.participant || msg.key.remoteJid;
}

function getText(msg) {
    return (
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        ""
    ).trim();
}

function getMention(msg) {
    return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}

function isOwner(id) {
    const pure = getPureNumber(id);
    return pure === OWNER_NUMBER || pure === OWNER_LID;
}

function isAdmin(id) {
    return adminsBot.includes(getPureNumber(id)) || isOwner(id);
}

// ===== STICKER =====
async function createSticker(sock, msg) {
    try {
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const image = quoted?.imageMessage || msg.message?.imageMessage;

        if (!image) {
            return sock.sendMessage(msg.key.remoteJid, {
                text: "❌ Preciso de uma imagem para criar figurinha!"
            });
        }

        const buffer = await downloadMediaMessage(
            { message: { imageMessage: image } },
            "buffer",
            {}
        );

        return sock.sendMessage(msg.key.remoteJid, {
            sticker: buffer
        });

    } catch (e) {
        console.error("❌ Erro ao criar sticker:", e.message);
        return sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Erro ao criar figurinha. Tente novamente!"
        });
    }
}

// ===== BUSCAR VIDEO NO YOUTUBE =====
async function searchYouTube(query) {
    try {
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        
        // Usar yt-dlp para buscar
        const result = await ytdlp(`ytsearch:${query}`, {
            dumpSingleJson: true,
            noWarnings: true,
            quiet: true
        });

        if (result && result.entries && result.entries.length > 0) {
            return result.entries[0].webpage_url;
        }

        return null;
    } catch (e) {
        console.error("Erro ao buscar YouTube:", e.message);
        return null;
    }
}

// ===== YOUTUBE DOWNLOADER =====
async function downloadAudio(sock, groupId, url) {
    try {
        await sock.sendMessage(groupId, { text: "⏳ Baixando áudio..." });

        const output = "./downloads/%(title)s.%(ext)s";
        
        if (!fs.existsSync("./downloads")) {
            fs.mkdirSync("./downloads", { recursive: true });
        }

        await ytdlp(url, {
            extractAudio: true,
            audioFormat: "mp3",
            audioQuality: "192",
            output: output,
            quiet: true,
            noWarnings: true
        });

        const files = fs.readdirSync("./downloads");
        const audioFile = files.find(f => f.endsWith(".mp3"));

        if (!audioFile) {
            return sock.sendMessage(groupId, {
                text: "❌ Erro ao encontrar o arquivo baixado!"
            });
        }

        const filePath = `./downloads/${audioFile}`;
        const fileSize = fs.statSync(filePath).size;

        // Limite
            return sock.sendMessage(groupId, {
                text: "❌ Áudio muito grande (máximo 100MB)!"
            });
        }

        await sock.sendMessage(groupId, {
            audio: fs.readFileSync(filePath),
            mimetype: "audio/mpeg"
        });

        fs.unlinkSync(filePath);

    } catch (e) {
        console.error("❌ Erro ao baixar áudio:", e.message);
        return sock.sendMessage(groupId, {
            text: `❌ Erro ao baixar áudio: ${e.message}`
        });
    }
}

async function downloadVideo(sock, groupId, url) {
    try {
        await sock.sendMessage(groupId, { text: "⏳ Baixando vídeo..." });

        const output = "./downloads/%(title)s.%(ext)s";
        
        if (!fs.existsSync("./downloads")) {
            fs.mkdirSync("./downloads", { recursive: true });
        }

        await ytdlp(url, {
            format: "best[ext=mp4]",
            output: output,
            quiet: true,
            noWarnings: true
        });

        const files = fs.readdirSync("./downloads");
        const videoFile = files.find(f => f.endsWith(".mp4"));

        if (!videoFile) {
            return sock.sendMessage(groupId, {
                text: "❌ Erro ao encontrar o arquivo baixado!"
            });
        }

        const filePath = `./downloads/${videoFile}`;
        const fileSize = fs.statSync(filePath).size;

        // Limite de 100MB para WhatsApp
        if (fileSize > 100 * 1024 * 1024) {
            fs.unlinkSync(filePath);
            return sock.sendMessage(groupId, {
                text: "❌ Vídeo muito grande (máximo 100MB)!"
            });
        }

        await sock.sendMessage(groupId, {
            video: fs.readFileSync(filePath),
            mimetype: "video/mp4"
        });

        fs.unlinkSync(filePath);

    } catch (e) {
        console.error("❌ Erro ao baixar vídeo:", e.message);
        return sock.sendMessage(groupId, {
            text: `❌ Erro ao baixar vídeo: ${e.message}`
        });
    }
}

// ===== COMANDOS =====
const commands = {
    MENU: handleMenu,
    MENUADM: handleMenuAdm,
    GETID: handleGetId,
    GETGROUPID: handleGetGroupId,
    MARCAR: handleMarcar,
    FIG: handleSticker,
    FIG1: handleSticker,
    PLY: handlePly,
    VLY: handleVly,
    BAN: handleBan,
    BANY: handleBanY,
    BANF: handleBanF,
    UNBAN: handleUnban,
    PROMOVER: handlePromove,
    REBAIXAR: handleDemote
};

async function handleMenu(sock, msg, groupId) {
    const imgPath = "./media/menu.jpg";
    if (fs.existsSync(imgPath)) {
        return sock.sendMessage(groupId, {
            image: fs.readFileSync(imgPath),
            caption: `🐾 *DOGPRESSED*

☆PLY (nome da música)
☆VLY (nome do vídeo)
☆FIG
☆GETID
☆GETGROUPID
☆MARCAR

☆MENUADM`
        });
    }
    return sock.sendMessage(groupId, {
        text: "🐾 *DOGPRESSED*\n\n(menu sem imagem)"
    });
}

async function handleMenuAdm(sock, msg, groupId, sender) {
    if (!isAdmin(sender)) return;
    return sock.sendMessage(groupId, {
        text: `⚙️ *MENU ADM*

☆BAN
☆BANY
☆BANF
☆UNBAN
☆PROMOVER
☆REBAIXAR`
    });
}

async function handleGetId(sock, msg, groupId, senderNum) {
    return sock.sendMessage(groupId, { text: senderNum });
}

async function handleGetGroupId(sock, msg, groupId) {
    return sock.sendMessage(groupId, { text: groupId });
}

async function handleMarcar(sock, msg, groupId) {
    if (!groupId.endsWith("@g.us")) return;
    try {
        const meta = await sock.groupMetadata(groupId);
        const members = meta.participants.map(p => p.id);
        return sock.sendMessage(groupId, {
            text: "📢 Chamando todos...",
            mentions: members
        });
    } catch (e) {
        console.error("Erro ao marcar:", e.message);
    }
}

async function handleSticker(sock, msg) {
    return createSticker(sock, msg);
}

async function handlePly(sock, msg, groupId, sender, senderNum, mentioned, args) {
    if (args.length < 2) {
        return sock.sendMessage(groupId, {
            text: "❌ Use: ☆PLY <nome da música>"
        });
    }

    const query = args.slice(1).join(" ");
    
    await sock.sendMessage(groupId, { text: "🔍 Procurando no YouTube..." });

    const url = await searchYouTube(query);

    if (!url) {
        return sock.sendMessage(groupId, {
            text: "❌ Nenhum resultado encontrado!"
        });
    }

    return downloadAudio(sock, groupId, url);
}

async function handleVly(sock, msg, groupId, sender, senderNum, mentioned, args) {
    if (args.length < 2) {
        return sock.sendMessage(groupId, {
            text: "❌ Use: ☆VLY <nome do vídeo>"
        });
    }

    const query = args.slice(1).join(" ");
    
    await sock.sendMessage(groupId, { text: "🔍 Procurando no YouTube..." });

    const url = await searchYouTube(query);

    if (!url) {
        return sock.sendMessage(groupId, {
            text: "❌ Nenhum resultado encontrado!"
        });
    }

    return downloadVideo(sock, groupId, url);
}

async function handleBan(sock, msg, groupId, sender, senderNum, mentioned) {
    if (!isAdmin(sender)) return;
    if (!mentioned.length) return;
    await sock.groupParticipantsUpdate(groupId, mentioned, "remove");
    return sock.sendMessage(groupId, { text: "🚫 Removido do grupo" });
}

async function handleBanY(sock, msg, groupId, sender, senderNum, mentioned) {
    if (!isAdmin(sender)) return;
    if (!mentioned.length) return;
    const num = getPureNumber(mentioned[0]);
    banY[num] = 8;
    return sock.sendMessage(groupId, { text: "🔇 8 chances restantes" });
}

async function handleBanF(sock, msg, groupId, sender, senderNum, mentioned) {
    if (!isAdmin(sender)) return;
    if (!mentioned.length) return;
    const num = getPureNumber(mentioned[0]);
    banF[num] = true;
    return sock.sendMessage(groupId, { text: "🔒 Permanentemente bloqueado" });
}

async function handleUnban(sock, msg, groupId, sender, senderNum, mentioned) {
    if (!isAdmin(sender)) return;
    if (!mentioned.length) return;
    const num = getPureNumber(mentioned[0]);
    delete banY[num];
    delete banF[num];
    return sock.sendMessage(groupId, { text: "🔓 Liberado" });
}

async function handlePromove(sock, msg, groupId, sender, senderNum, mentioned) {
    if (!isAdmin(sender)) return;
    if (!mentioned.length) return;
    await sock.groupParticipantsUpdate(groupId, mentioned, "promote");
    return sock.sendMessage(groupId, { text: "⬆️ Promovido a admin" });
}

async function handleDemote(sock, msg, groupId, sender, senderNum, mentioned) {
    if (!isAdmin(sender)) return;
    if (!mentioned.length) return;
    await sock.groupParticipantsUpdate(groupId, mentioned, "demote");
    return sock.sendMessage(groupId, { text: "⬇️ Rebaixado" });
}

// ===== BOT PRINCIPAL =====
async function start() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState("auth");
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({ version, auth: state });
        const startTime = Date.now();

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", ({ connection, qr }) => {
            if (qr) qrcode.generate(qr, { small: true });
            if (connection === "open") console.log("✅ DOGPRESSED ONLINE");
            if (connection === "close") {
                console.log("⚠️ Reconectando...");
                start();
            }
        });

        sock.ev.on("messages.upsert", async ({ messages }) => {
            try {
                const msg = messages[0];
                if (!msg?.message) return;
                if (msg.key.remoteJid === "status@broadcast") return;

                const ts = Number(msg.messageTimestamp || 0) * 1000;
                if (ts < startTime) return;

                const sender = getSender(msg);
                const senderNum = getPureNumber(sender);
                const text = getText(msg);
                const mentioned = getMention(msg);
                const groupId = msg.key.remoteJid;

                if (!text || !text.startsWith(COMMAND_PREFIX)) return;

                // ===== SISTEMA DE BAN =====
                if (banF[senderNum]) {
                    await sock.sendMessage(groupId, { text: "🔒 Silêncio absoluto..." });
                    await sock.groupParticipantsUpdate(groupId, [sender], "remove");
                    return;
                }

                if (banY[senderNum]) {
                    banY[senderNum]--;
                    if (banY[senderNum] <= 0) {
                        delete banY[senderNum];
                        await sock.sendMessage(groupId, {
                            text: "⏹️ Limite de chances atingido!"
                        });
                        await sock.groupParticipantsUpdate(groupId, [sender], "remove");
                        return;
                    }
                    return sock.sendMessage(groupId, {
                        text: `🔇 Não fale... Restam ${banY[senderNum]} chance(s).`
                    });
                }

                // ===== PROCESSADOR DE COMANDOS =====
                const args = text.slice(1).trim().split(/\s+/);
                const command = args[0].toUpperCase();

                const handler = commands[command];
                if (handler) {
                    await handler(sock, msg, groupId, sender, senderNum, mentioned, args);
                }

            } catch (e) {
                console.error("❌ Erro ao processar mensagem:", e.message);
            }
        });

    } catch (e) {
        console.error("❌ Erro ao iniciar bot:", e.message);
        setTimeout(start, 5000);
    }
}

start();