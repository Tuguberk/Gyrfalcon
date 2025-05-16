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
            description: "Generates a riddle with id and question from backend.",
            args: [] as const,
            executable: async (_, logger) => {
                try {
                    // const connection_string = 'http://127.0.0.1:5005/generateRiddle'; // Development
                    const connection_string = 'http://backend:5001/generateRiddle'; // Docker
                    const response = await fetch( connection_string, {
                        method: "GET"
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        logger(`Error generating riddle: ${errorData.error}, ${connection_string}`);
                        return new ExecutableGameFunctionResponse(
                            ExecutableGameFunctionStatus.Failed,
                            `Error: ${errorData.error}`
                        );
                    }
                    
                    const data = await response.json();
                    const riddle = {
                        id: data.riddleId,
                        riddle: data.question,
                        answer: data.answer
                    };

                    logger(`Generated riddle (via backend): ${riddle.riddle}`);

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