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
const game_telegram_plugin_1 = __importDefault(require("@virtuals-protocol/game-telegram-plugin"));
const game_1 = require("@virtuals-protocol/game");
class TelegramPluginDev extends game_telegram_plugin_1.default {
    constructor(options) {
        super(options);
    }
    get generateRiddleFunction() {
        return new game_1.GameFunction({
            name: "generate_riddle",
            description: "Generates a riddle with id, question, and answer.",
            args: [],
            executable: (_, logger) => __awaiter(this, void 0, void 0, function* () {
                try {
                    // 🧪 MOCK API Simülasyonu
                    const mockApiResponse = {
                        id: 42,
                        question: "Geceleri parlar, gündüzleri kaybolurum. Ne olduğumu tahmin et bakalım?",
                        answer: "ay"
                    };
                    const riddle = {
                        id: mockApiResponse.id,
                        riddle: mockApiResponse.question,
                        answer: mockApiResponse.answer
                    };
                    logger(`Generated riddle (mocked): ${riddle.riddle}`);
                    return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Done, JSON.stringify(riddle));
                }
                catch (e) {
                    logger(`Error generating riddle: ${e.message}`);
                    return new game_1.ExecutableGameFunctionResponse(game_1.ExecutableGameFunctionStatus.Failed, "Failed to generate riddle.");
                }
            })
        });
    }
}
exports.default = TelegramPluginDev;
