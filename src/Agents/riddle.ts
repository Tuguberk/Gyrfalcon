import dotenv from "dotenv";
dotenv.config();

import { GameAgent } from "@virtuals-protocol/game";
import TelegramPluginDev from "../Plugins/telegramPluginDev";

const telegramPlugin = new TelegramPluginDev({
  credentials: { botToken: process.env.BOT_TOKEN! },
});

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

async function getRiddleState(): Promise<Record<string, any>> {
  return { currentRiddle: null };
}

const riddleAgent = new GameAgent(process.env.GAME_AGENT_KEY!, {
  name: "Riddle Agent",
  goal: "Handle riddle-related commands",
  description: "Replies to /ge /an /ri commands in Telegram",
  getAgentState: getRiddleState,
  workers: [
    telegramPlugin.getWorker({
      functions: [
        telegramPlugin.sendMessageFunction,
        telegramPlugin.generateRiddleFunction,
      ],
    }),
  ],
});

type ChatState = {
  currentRiddle?: { id: number; riddle: string; answer: string };
  answeredUsers: Set<string>;
  isFirstAnswered: boolean;
  firstWinner?: string;
};
const chatStates = new Map<number, ChatState>();

(async () => {
  autoReplyAgent.setLogger((agent, msg) => {
    console.log(`-----[${agent.name}]-----\n${msg}\n`);
  });

  await autoReplyAgent.init();
  await riddleAgent.init();

  telegramPlugin.onMessage(async (msg) => {
    const isPrivate  = msg.chat.type === "private";
    const text       = msg.text?.trim() ?? "";
    const lowercase  = text.toLowerCase();
    const chatId     = msg.chat.id;
    const userId     = msg.from?.id!;
    const username   = msg.from?.username || `user_${userId}`;
    const authorized = [1103876795, 987654321, 801820805];

    const tgWorker     = autoReplyAgent.getWorkerById(telegramPlugin.getWorker().id);
    const riddleWorker = riddleAgent.getWorkerById(telegramPlugin.getWorker().id);

    const DEFAULT_CHAT = Number(process.env.DEFAULT_RIDDLE_CHAT_ID);

    if (!lowercase.startsWith("/")) {
      const task = `Reply to chat id: ${chatId} and the incoming message: "${text}" and the message id is: ${msg.message_id}`;
      await tgWorker.runTask(task, { verbose: true });
      return;
    }

    if (lowercase.startsWith("/ge")) {
      if (!authorized.includes(userId)) {
        await riddleWorker.runTask(
          `Send message "❌ Bu komutu kullanma izniniz yok." to chat id: ${chatId}`,
          { verbose: true }
        );
        return;
      }

      const parts        = text.split(/\s+/);          // "/ge" veya "/ge -100..."
      const targetChatId = Number(parts[1] ?? DEFAULT_CHAT ?? chatId);

      if (!targetChatId) {
        await riddleWorker.runTask(
          `Send message "❗️ Hedef chatId belirtilmedi. /ge <chatId> şeklinde kullanın" to chat id: ${chatId}`,
          { verbose: true }
        );
        return;
      }

      const result  = await telegramPlugin.generateRiddleFunction.executable({}, console.log);
      const riddle  = JSON.parse(result.feedback);

      chatStates.set(targetChatId, {
        currentRiddle  : riddle,
        answeredUsers  : new Set(),
        isFirstAnswered: false,
        firstWinner    : undefined,
      });

      await riddleWorker.runTask(
        `Send message "🧩 ${riddle.riddle}" to chat id: ${targetChatId}`,
        { verbose: true }
      );

      if (isPrivate && chatId !== targetChatId) {
        await riddleWorker.runTask(
          `Send message "Bilmece gönderildi → chatId: ${targetChatId}" to chat id: ${chatId}`,
          { verbose: true }
        );
      }
      return;
    }

    if (lowercase === "/ri") {
      const state  = chatStates.get(chatId);
      const riddle = state?.currentRiddle;
      const info   = riddle
        ? `🔎 Mevcut bilmece: ${riddle.riddle}`
        : "🚫 Henüz bir bilmece oluşturulmadı.";
      await riddleWorker.runTask(
        `Send message "${info}" to chat id: ${chatId}`,
        { verbose: true }
      );
      return;
    }

    if (lowercase.startsWith("/wal ")) {
      const wallet = text.replace(/^\/wal\s+/i, "").trim();
      const state  = chatStates.get(chatId);

      let reply = "";
      if (!state || !state.firstWinner) {
        reply = "❌ Önce bilmecede büyük ödülü kazanmalısın.";
      } else if (username !== state.firstWinner) {
        reply = `⛔️ Üzgünüz ${username}, büyük ödülü sen kazanmadın.`;
      } else {
        try {
          const res = await fetch("https://mock.api/save-wallet", {
            method : "POST",
            headers: { "Content-Type": "application/json" },
            body   : JSON.stringify({
              username,
              wallet,
              riddleId: state.currentRiddle?.id,
            }),
          });
          if (!res.ok) throw new Error("API error");
          reply = `✅ Cüzdan adresin başarıyla kaydedildi ${username}.`;
        } catch (e) {
          reply = `🚫 Kayıt sırasında hata oluştu: ${(e as Error).message}`;
        }
      }

      await riddleWorker.runTask(`Send message "${reply}" to chat id: ${chatId}`, { verbose: true });
      return;
    }

    if (lowercase.startsWith("/an ")) {
      const userAnswer = text.replace(/^\/an\s+/i, "").toLowerCase();
      const state      = chatStates.get(chatId);

      let reply = "";
      if (!state?.currentRiddle) {
        reply = "❌ Henüz bir bilmece oluşturulmadı.";
      } else if (userAnswer === state.currentRiddle.answer.toLowerCase()) {
        if (!state.answeredUsers.has(username)) {
          state.answeredUsers.add(username);
          if (!state.isFirstAnswered) {
            state.isFirstAnswered = true;
            state.firstWinner     = username;
            reply = `🏆 Tebrikler ${username}, ilk doğru cevabı verdin! Büyük ödül senin! 🎁`;
          } else {
            reply = `🎉 Doğru cevap ${username}! Küçük ödül senin. 🎁`;
          }
        } else {
          reply = `✅ Zaten doğru cevabı verdin ${username}, ödül alındı.`;
        }
      } else {
        reply = `❌ Maalesef ${username}, yanlış cevap.`;
      }

      chatStates.set(chatId, state!);
      await riddleWorker.runTask(`Send message "${reply}" to chat id: ${chatId}`, { verbose: true });
      return;
    }

    if (lowercase === "/an") {
      await riddleWorker.runTask(
        `Send message "✉️ Cevap bekleniyor..." to chat id: ${chatId}`,
        { verbose: true }
      );
      return;
    }

    await riddleWorker.runTask(
      `Send message "✉️ Geçersiz komut" to chat id: ${chatId}`,
      { verbose: true }
    );
  });
})();
