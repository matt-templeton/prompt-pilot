import * as vscode from 'vscode';

export interface PromptPilotSettings {
    openaiApiKey?: string;
    anthropicApiKey?: string;
}

export class SettingsManager {
    private globalState: vscode.Memento;
    private workspaceState: vscode.Memento;

    constructor(context: vscode.ExtensionContext) {
        this.globalState = context.globalState;
        this.workspaceState = context.workspaceState;
    }

    async getGlobalSettings(): Promise<PromptPilotSettings> {
        try {
            return {
                openaiApiKey: await this.globalState.get('openaiApiKey'),
                anthropicApiKey: await this.globalState.get('anthropicApiKey'),
            };
        } catch (error) {
            console.error('Error getting settings:', error);
            return {};
        }
    }

    async setGlobalSetting<K extends keyof PromptPilotSettings>(
        key: K,
        value: PromptPilotSettings[K]
    ): Promise<void> {
        try {
            await this.globalState.update(key, value);
        } catch (error) {
            console.error(`Error setting ${key}:`, error);
            throw new Error(`Failed to save ${key}`);
        }
    }
} 