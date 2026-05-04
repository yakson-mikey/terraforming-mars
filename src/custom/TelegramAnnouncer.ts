import { Log } from "../common/logs/Log";
import { LogMessage } from "../common/logs/LogMessage";
import { LogMessageData } from "../common/logs/LogMessageData";
import { IGame } from "../server/IGame";

interface TelegramPlayer {
    name: string;
    aliases: string[];
}

export class TelegramAnnouncer {
    private static instance: TelegramAnnouncer;

    private awaitingResponse: boolean = false;
    private pendingMessages: string[] = [];

    private turnAnnouncements: string[] = ['Your turn, PLAYER_NAME'];
    private players: TelegramPlayer[] = [];
    private botToken: string | undefined = undefined;
    private chatId: string | undefined = undefined;
    private baseUrl: string | undefined = undefined;
    private sendNewTurnFlag: boolean = true;
    private sendLogsFlag: boolean = false;
    private sendDraftFlag: boolean = true;
    private sendResearchFlag: boolean = true;

    private constructor() { }

    public static getInstance(): TelegramAnnouncer {
        if (!this.instance) {
            this.instance = new TelegramAnnouncer();
            this.instance.parseEnvData();
        }

        return this.instance;
    }

    public sendGameStart(game: IGame) {
        this.sendText(this.baseUrl
            ? `A new [game](${this.baseUrl}/game?id=${game.id}) was just created!`
            : 'A new game was just created!');
    }

    public sendDraft(game: IGame) {
        if (this.sendDraftFlag) {
            const msg = 'Alright folks, let\'s draft: ' + game.players.map(p => this.getTelegramName(p.name)).join(', ');
            this.sendText(msg);
        }
    }

    public sendResearch(game: IGame) {
        if (this.sendResearchFlag) {
            const msg = 'Пора инвестировать в говно, парни: ' + game.players.map(p => this.getTelegramName(p.name)).join(', ');
            this.sendText(msg);
        }
    }

    public sendNewPlayerTurn(playerName: string) {
        if (this.sendNewTurnFlag) {
            this.sendText(this.getRandomNewTurnText(playerName));
        }
    }

    public sendLogMessage(message: LogMessage) {
        if (this.sendLogsFlag) {
            const text = Log.applyData(message, (datum: LogMessageData) => {
                return datum?.value?.toString() ?? '';
            });

            this.sendText(text);
        }
    }

    private sendText(text: string) {
        this.pendingMessages.push(text);

        if (!this.awaitingResponse) {
            this.startPosting();
        }
    }

    private async startPosting() {
        this.awaitingResponse = true;

        while (this.pendingMessages.length > 0) {
            await this.post(this.pendingMessages.shift());
        }

        this.awaitingResponse = false;
    }

    private async post(message: string | undefined) {
        if (!this.botToken || !this.chatId) {
            console.log('Missing bot token or chat id!');
            return;
        }

        try {
            const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: this.chatId,
                    text: message,
                    parse_mode: "Markdown"
                }),
            });

            if (!response.ok) {
                throw new Error(`Telegram send message error: ${response.status}`);
            }
        } catch (error) {
            console.error(error);
        }
    }

    private getRandomNewTurnText(playerName: string): string {
        const tgName = this.getTelegramName(playerName);

        return this.turnAnnouncements.length > 0
            ? this.turnAnnouncements[Math.floor(Math.random() * this.turnAnnouncements.length)].replaceAll('PLAYER_NAME', tgName)
            : `Your turn, ${tgName}`;
    }

    private getTelegramName(playerName: string): string {
        let tgName = playerName;

        if (this.players.length > 0) {
            const result = this.players.find(p => p.aliases.includes(playerName));
            if (result)
                tgName = result.name;
        }

        return tgName;
    }

    private parseEnvData() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN;
        this.chatId = process.env.TELEGRAM_CHAT_ID;
        this.baseUrl = process.env.BASE_URL;

        this.turnAnnouncements = process.env.TELEGRAM_ANNOUNCE_TURN_MESSAGES
            ? process.env.TELEGRAM_ANNOUNCE_TURN_MESSAGES.split("|")
            : this.turnAnnouncements;

        this.players = process.env.TELEGRAM_PLAYERS
            ? JSON.parse(process.env.TELEGRAM_PLAYERS)
            : this.players;

        this.sendLogsFlag = process.env.TELEGRAM_SEND_LOGS
            ? process.env.TELEGRAM_SEND_LOGS === "true"
            : this.sendLogsFlag;

        this.sendNewTurnFlag = process.env.TELEGRAM_ANNOUNCE_TURN
            ? process.env.TELEGRAM_ANNOUNCE_TURN === "true"
            : this.sendNewTurnFlag;

        this.sendDraftFlag = process.env.TELEGRAM_SEND_DRAFT
            ? process.env.TELEGRAM_SEND_DRAFT === "true"
            : this.sendNewTurnFlag;

        this.sendResearchFlag = process.env.TELEGRAM_SEND_RESEARCH
            ? process.env.TELEGRAM_SEND_RESEARCH === "true"
            : this.sendResearchFlag;
    }
}