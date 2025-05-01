import TelegramPlugin from "@virtuals-protocol/game-telegram-plugin";

import {
    GameFunction,
    ExecutableGameFunctionResponse,
    ExecutableGameFunctionStatus
} from "@virtuals-protocol/game";


class TelegramPluginDev extends TelegramPlugin {
    constructor(options: ConstructorParameters<typeof TelegramPlugin>[0]) {
        super(options);
    }

    get generateRiddleFunction() {
        return new GameFunction({
            name: "generate_riddle",
            description: "Generates a riddle with id, question, and answer.",
            args: [] as const,
            executable: async (_, logger) => {
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

                    return new ExecutableGameFunctionResponse(
                        ExecutableGameFunctionStatus.Done,
                        JSON.stringify(riddle)
                    );
                } catch (e: any) {
                    logger(`Error generating riddle: ${e.message}`);

                    return new ExecutableGameFunctionResponse(
                        ExecutableGameFunctionStatus.Failed,
                        "Failed to generate riddle."
                    );
                }
            }
        });
    }
}

export default TelegramPluginDev;