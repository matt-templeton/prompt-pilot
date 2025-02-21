import * as vscode from 'vscode';
import * as path from 'path';
import { FileTreeProvider } from './file_tree_provider';
import { SettingsManager } from '../services/SettingsManager';

interface OpenAIModel {
  id: string;
  created: number;
  owned_by: string;
}

interface OpenAIModelsResponse {
  data: OpenAIModel[];
  object: string;
}

interface WebviewMessage {
    type: string;
    models?: OpenAIModel[];
    settings?: {
        openaiApiKey?: string;
        anthropicApiKey?: string;
    };
    files?: {path: string; isDirectory: boolean}[];
}

export class PromptPanelProvider {
    public static readonly viewType = 'promptPilot.promptPanel';
    private panel: vscode.WebviewPanel | undefined;
    private settingsManager: SettingsManager;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly fileTreeProvider: FileTreeProvider
    ) {
        this.settingsManager = new SettingsManager(context);
    }

    public showPanel() {
        const columnToShowIn = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (this.panel) {
            this.panel.reveal(columnToShowIn);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            PromptPanelProvider.viewType,
            'Prompt Pilot',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'views', 'prompt-panel', 'build'))
                ]
            }
        );

        // Set HTML content
        this.panel.webview.html = this._getWebviewContent();

        // Set up message handling when panel is created
        this.panel.webview.onDidReceiveMessage(
            async message => {
                console.log('PromptPanelProvider: Received message from webview:', message);
                try {
                    switch (message.type) {
                        case 'getSettings': {
                            const settings = await this.settingsManager.getGlobalSettings();
                            this.panel?.webview.postMessage({
                                type: 'settings',
                                settings: settings
                            });
                            break;
                        }
                        case 'updateSettings': {
                            const { settings } = message;
                            await this.settingsManager.setGlobalSetting('openaiApiKey', settings.openaiApiKey);
                            await this.settingsManager.setGlobalSetting('anthropicApiKey', settings.anthropicApiKey);
                            vscode.window.showInformationMessage('Settings saved successfully');
                            break;
                        }
                        case 'getSelectedFiles': {
                            const files = this.fileTreeProvider.getSelectedFiles();
                            console.log('PromptPanelProvider: Sending selected files to webview:', files);
                            this.panel?.webview.postMessage({
                                type: 'selectedFiles',
                                files: files
                            });
                            break;
                        }
                        case 'toggleFileSelection': {
                            if (message.action === 'uncheck') {
                                // Handle uncheck action
                                await this.fileTreeProvider.uncheckItemByPath(message.file);
                            } else {
                                // Handle regular toggle
                                vscode.commands.executeCommand('promptRepo.toggleSelection', {
                                    resourceUri: vscode.Uri.file(message.file)
                                });
                            }
                            break;
                        }
                        case 'getModels': {
                            const settings = await this.settingsManager.getGlobalSettings();
                            const apiKey = settings.openaiApiKey;
                            console.log("API Key from settings:", apiKey);
                            
                            if (apiKey) {
                                const models = await this.fetchOpenAIModels(apiKey);
                                this.panel?.webview.postMessage({
                                    type: 'models',
                                    models: models
                                });
                            }
                            break;
                        }
                    }
                } catch (error) {
                    console.error('Error handling message:', error);
                    vscode.window.showErrorMessage('Failed to update settings');
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Add listener for selection changes
        this.fileTreeProvider.onDidChangeSelection(files => {
            console.log('PromptPanelProvider: Selection changed, sending to webview:', files);
            this.panel?.webview.postMessage({
                type: 'selectedFiles',
                files: files
            });
        });

        this.panel.onDidDispose(
            () => {
                this.panel = undefined;
            },
            null,
            this.context.subscriptions
        );
    }

    private _getWebviewContent() {
        const scriptPathOnDisk = vscode.Uri.file(
            path.join(this.context.extensionPath, 'src', 'views', 'prompt-panel', 'build', 'bundle.js')
        );
        const scriptUri = this.panel!.webview.asWebviewUri(scriptPathOnDisk);

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Prompt Pilot</title>
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel!.webview.cspSource} 'unsafe-inline'; script-src ${this.panel!.webview.cspSource} 'unsafe-inline';">
            </head>
            <body>
                <div id="root"></div>
                <script>
                    // Acquire API before any React code runs
                    const vscode = acquireVsCodeApi();
                    window._vscodeApi = vscode;
                </script>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    private async fetchOpenAIModels(apiKey: string): Promise<OpenAIModel[]> {
        try {
            console.log("fetchOpenAIModels", apiKey);
            const response = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(response);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json() as OpenAIModelsResponse;
            console.log(data);
            return data.data;
        } catch (error) {
            console.error('Error fetching OpenAI models:', error);
            return [];
        }
    }

    public postMessageToWebview(message: WebviewMessage) {
        this.panel?.webview.postMessage(message);
    }
} 