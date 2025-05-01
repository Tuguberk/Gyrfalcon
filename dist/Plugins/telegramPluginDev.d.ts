import TelegramPlugin from "@virtuals-protocol/game-telegram-plugin";
import { GameFunction } from "@virtuals-protocol/game";
declare class TelegramPluginDev extends TelegramPlugin {
    constructor(options: ConstructorParameters<typeof TelegramPlugin>[0]);
    get generateRiddleFunction(): GameFunction<[]>;
}
export default TelegramPluginDev;
