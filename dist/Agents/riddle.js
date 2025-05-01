"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const game_1 = require("@virtuals-protocol/game");
const telegramPluginDev_1 = __importDefault(require("../Plugins/telegramPluginDev"));
const telegramPlugin = new telegramPluginDev_1.default({
    credentials: {
        botToken: process.env.BOT_TOKEN,
    },
});
telegramPlugin.onMessage((msg) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Custom message handler:', msg);
}));
function getRiddleState() {
    return __awaiter(this, void 0, void 0, function* () {
        return {
            currentRiddle: null
        };
    });
}
const chatStates = new Map();
const autoReplyAgent = new game_1.GameAgent(process.env.GAME_AGENT_KEY, {
    name: "Telegram Bot",
    goal: "Auto reply message",
    description: "This agent will auto reply to messages",
    workers: [
        telegramPlugin.getWorker({
            functions: [
                telegramPlugin.sendMessageFunction,
                telegramPlugin.pinnedMessageFunction,
                telegramPlugin.unPinnedMessageFunction,
                telegramPlugin.createPollFunction,
                telegramPlugin.sendMediaFunction,
                telegramPlugin.deleteMessageFunction,
            ],
        }),
    ],
});
const riddleAgent = new game_1.GameAgent(process.env.GAME_AGENT_KEY, {
    name: "Riddle Agent",
    goal: "Handle riddle-related commands",
    description: "Replies to @generateRiddle and @answer commands in Telegram",
    getAgentState: getRiddleState,
    workers: [
        telegramPlugin.getWorker({
            functions: [
                telegramPlugin.sendMessageFunction,
                telegramPlugin.generateRiddleFunction
            ]
        })
    ]
});
(() => __awaiter(void 0, void 0, void 0, function* () {
    autoReplyAgent.setLogger((autoReplyAgent, message) => {
        console.log(`-----[${autoReplyAgent.name}]-----`);
        console.log(message);
        console.log("\n");
    });
    yield autoReplyAgent.init();
    yield riddleAgent.init();
    telegramPlugin.onMessage((msg) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const agentTgWorker = autoReplyAgent.getWorkerById(telegramPlugin.getWorker().id);
        const agentRiddleWorker = riddleAgent.getWorkerById(telegramPlugin.getWorker().id);
        const text = (_a = msg.text) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase();
        const chatId = msg.chat.id;
        const username = ((_b = msg.from) === null || _b === void 0 ? void 0 : _b.username) || `user_${(_c = msg.from) === null || _c === void 0 ? void 0 : _c.id}`;
        if (!text.startsWith("@")) {
            const task = "Reply to chat id: " + msg.chat.id + " and the incoming is message: " + msg.text + " and the message id is: " + msg.message_id;
            yield agentTgWorker.runTask(task, {
                verbose: true,
            });
        }
        if (text === "@ge") {
            const result = yield telegramPlugin.generateRiddleFunction.executable({}, console.log);
            const riddle = JSON.parse(result.feedback);
            chatStates.set(chatId, {
                currentRiddle: riddle,
                answeredUsers: new Set(),
                isFirstAnswered: false
            });
            const task = `Send message "🧩 ${riddle.riddle}" to chat id: ${chatId}`;
            yield agentRiddleWorker.runTask(task, { verbose: true });
        }
        else if (text === "@ri") {
            const state = chatStates.get(chatId);
            const riddle = state === null || state === void 0 ? void 0 : state.currentRiddle;
            const message = riddle
                ? `🔎 Mevcut bilmece: ${riddle.riddle}`
                : "🚫 Henüz bir bilmece oluşturulmadı.";
            const task = `Send message "${message}" to chat id: ${chatId}`;
            yield agentRiddleWorker.runTask(task, { verbose: true });
        }
        else if (text.startsWith("@wal ")) {
            const walletAddress = text.replace("@wal ", "").trim();
            const state = chatStates.get(chatId);
            let message;
            if (!state || !state.firstWinner) {
                message = "❌ Önce bilmecede büyük ödülü kazanmalısın.";
            }
            else if (username !== state.firstWinner) {
                message = `⛔️ Üzgünüz ${username}, büyük ödülü sen kazanmadın.`;
            }
            else {
                try {
                    const res = yield fetch("https://mock.api/save-wallet", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            username: username,
                            wallet: walletAddress,
                            riddleId: (_d = state.currentRiddle) === null || _d === void 0 ? void 0 : _d.id
                        })
                    });
                    if (!res.ok)
                        throw new Error("API error");
                    message = `✅ Cüzdan adresin başarıyla kaydedildi ${username}.`;
                }
                catch (e) {
                    message = `🚫 Kayıt sırasında hata oluştu: ${e.message}`;
                }
            }
            const task = `Send message "${message}" to chat id: ${chatId}`;
            yield agentRiddleWorker.runTask(task, { verbose: true });
        }
        else if (text.startsWith("@an ")) {
            const userAnswer = text.replace("@an ", "").trim().toLowerCase();
            const state = chatStates.get(chatId);
            let message = "";
            if (!state || !state.currentRiddle || !state.currentRiddle.answer) {
                message = "❌ Henüz bir bilmece oluşturulmadı.";
            }
            else {
                const correctAnswer = state.currentRiddle.answer.toLowerCase();
                if (userAnswer === correctAnswer) {
                    if (!state.answeredUsers.has(username)) {
                        state.answeredUsers.add(username);
                        if (!state.isFirstAnswered) {
                            message = `🏆 Tebrikler ${username}, ilk doğru cevabı verdin! Büyük ödül senin! 🎁`;
                            state.isFirstAnswered = true;
                            state.firstWinner = username;
                        }
                        else {
                            message = `🎉 Doğru cevap ${username}! Küçük ödül senin. 🎁`;
                        }
                    }
                    else {
                        message = `✅ Zaten doğru cevabı verdin ${username}, ödül alındı.`;
                    }
                }
                else {
                    message = `❌ Maalesef ${username}, yanlış cevap.`;
                }
                chatStates.set(chatId, state);
            }
            const task = `Send message "${message}" to chat id: ${chatId}`;
            yield agentRiddleWorker.runTask(task, { verbose: true });
        }
        else if (text === "@an") {
            const task = `Send message "✉️ Cevap bekleniyor..." to chat id: ${chatId}`;
            yield agentRiddleWorker.runTask(task, { verbose: true });
        }
    }));
}))();
