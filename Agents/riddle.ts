import dotenv from "dotenv";
dotenv.config();

import { GameAgent } from "@virtuals-protocol/game";
import TelegramPluginDev from "./telegramPluginDev";

const telegramPlugin = new TelegramPluginDev({
    credentials: {
        botToken: process.env.BOT_TOKEN!,
    },
});

telegramPlugin.onMessage(async (msg) => {
    console.log('Custom message handler:', msg);
});

async function getRiddleState(): Promise<Record<string, any>> {
    return {
        currentRiddle: null
    };
}

const chatStates = new Map<number, {
    currentRiddle?: { id: number, riddle: string, answer: string },
    answeredUsers: Set<string>,
    isFirstAnswered: boolean,
    firstWinner?: string
}>();

const autoReplyAgent = new GameAgent(process.env.GAME_AGENT_KEY!, {
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

const riddleAgent = new GameAgent(process.env.GAME_AGENT_KEY!, {
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


(async () => {
    autoReplyAgent.setLogger((autoReplyAgent, message) => {
        console.log(`-----[${autoReplyAgent.name}]-----`);
        console.log(message);
        console.log("\n");
    });

    await autoReplyAgent.init();
    await riddleAgent.init();

    telegramPlugin.onMessage(async (msg) => {

        const agentTgWorker = autoReplyAgent.getWorkerById(telegramPlugin.getWorker().id);
        const agentRiddleWorker = riddleAgent.getWorkerById(telegramPlugin.getWorker().id);

        const text = msg.text?.trim().toLowerCase();
        const chatId = msg.chat.id;
        const username = msg.from?.username || `user_${msg.from?.id}`;

        if (!text.startsWith("@")) {
            const task = "Reply to chat id: " + msg.chat.id + " and the incoming is message: " + msg.text + " and the message id is: " + msg.message_id;

            await agentTgWorker.runTask(task, {
                verbose: true,
            });
        }

        if (text === "@ge") {
            const result = await telegramPlugin.generateRiddleFunction.executable({}, console.log);
            const riddle = JSON.parse(result.feedback);

            chatStates.set(chatId, {
                currentRiddle: riddle,
                answeredUsers: new Set(),
                isFirstAnswered: false
            });

            const task = `Send message "🧩 ${riddle.riddle}" to chat id: ${chatId}`;
            await agentRiddleWorker.runTask(task, { verbose: true });
        }

        else if (text === "@ri") {
            const state = chatStates.get(chatId);
            const riddle = state?.currentRiddle;

            const message = riddle
                ? `🔎 Mevcut bilmece: ${riddle.riddle}`
                : "🚫 Henüz bir bilmece oluşturulmadı.";

            const task = `Send message "${message}" to chat id: ${chatId}`;
            await agentRiddleWorker.runTask(task, { verbose: true });
        }

        else if (text.startsWith("@wal ")) {
            const walletAddress = text.replace("@wal ", "").trim();
            const state = chatStates.get(chatId);

            let message;

            if (!state || !state.firstWinner) {
                message = "❌ Önce bilmecede büyük ödülü kazanmalısın.";
            } else if (username !== state.firstWinner) {
                message = `⛔️ Üzgünüz ${username}, büyük ödülü sen kazanmadın.`;
            } else {
                try {
                    const res = await fetch("https://mock.api/save-wallet", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            username: username,
                            wallet: walletAddress,
                            riddleId: state.currentRiddle?.id
                        })
                    });

                    if (!res.ok) throw new Error("API error");

                    message = `✅ Cüzdan adresin başarıyla kaydedildi ${username}.`;
                } catch (e) {
                    message = `🚫 Kayıt sırasında hata oluştu: ${(e as Error).message}`;
                }
            }

            const task = `Send message "${message}" to chat id: ${chatId}`;
            await agentRiddleWorker.runTask(task, { verbose: true });
        }

        else if (text.startsWith("@an ")) {
            const userAnswer = text.replace("@an ", "").trim().toLowerCase();
            const state = chatStates.get(chatId);

            let message = "";

            if (!state || !state.currentRiddle || !state.currentRiddle.answer) {
                message = "❌ Henüz bir bilmece oluşturulmadı.";
            } else {
                const correctAnswer = state.currentRiddle.answer.toLowerCase();

                if (userAnswer === correctAnswer) {
                    if (!state.answeredUsers.has(username)) {
                        state.answeredUsers.add(username);

                        if (!state.isFirstAnswered) {
                            message = `🏆 Tebrikler ${username}, ilk doğru cevabı verdin! Büyük ödül senin! 🎁`;
                            state.isFirstAnswered = true;
                            state.firstWinner = username;
                        } else {
                            message = `🎉 Doğru cevap ${username}! Küçük ödül senin. 🎁`;
                        }
                    } else {
                        message = `✅ Zaten doğru cevabı verdin ${username}, ödül alındı.`;
                    }
                } else {
                    message = `❌ Maalesef ${username}, yanlış cevap.`;
                }

                chatStates.set(chatId, state);
            }

            const task = `Send message "${message}" to chat id: ${chatId}`;
            await agentRiddleWorker.runTask(task, { verbose: true });
        }

        else if (text === "@an") {
            const task = `Send message "✉️ Cevap bekleniyor..." to chat id: ${chatId}`;
            await agentRiddleWorker.runTask(task, { verbose: true });
        }

    });
})();
