import * as vscode from 'vscode';
import * as path from 'path';
import { FileTreeProvider } from './file_tree_provider';
import { SettingsManager } from '../services/SettingsManager';
import OpenAI from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import type { Anthropic as AnthropicType } from '@anthropic-ai/sdk';
import { encoding_for_model, TiktokenModel } from "tiktoken";

interface OpenAIModel {
  id: string;
  created: number;
  owned_by: string;
}

interface ModelsByProvider {
  openai: OpenAIModel[];
  anthropic: AnthropicType.ModelInfo[];
}

interface WebviewMessage {
    type: string;
    models?: ModelsByProvider;
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
    private selectedModel = '';

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly fileTreeProvider: FileTreeProvider
    ) {
        this.settingsManager = new SettingsManager(context);
    }

    public showPanel() {
        console.log("PromptPanelProvider: showPanel called");
        const columnToShowIn = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (this.panel) {
            console.log("PromptPanelProvider: Reusing existing panel");
            this.panel.reveal(columnToShowIn);
            return;
        }

        console.log("PromptPanelProvider: Creating new panel");
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

        // Fix the HTML content setting
        const html = this._getWebviewContent();
        console.log("PromptPanelProvider: Setting HTML content");
        this.panel.webview.html = html;

        // Set up message handling when panel is created
        this.panel.webview.onDidReceiveMessage(
            async message => {
                console.log('PromptPanelProvider: Received message:', message);
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
                            // Send current selection to webview
                            this.panel?.webview.postMessage({
                                type: 'selectedFiles',
                                files: message.files || []
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
                            const modelsByProvider: ModelsByProvider = {
                                openai: [],
                                anthropic: []
                            };
                            
                            if (settings.openaiApiKey) {
                                modelsByProvider.openai = await this.fetchOpenAIModels(settings.openaiApiKey);
                            }
                            
                            if (settings.anthropicApiKey) {
                                console.log("GOT API KEY: ", settings.anthropicApiKey);
                                modelsByProvider.anthropic = await this.fetchAnthropicModels(settings.anthropicApiKey);
                            }

                            this.panel?.webview.postMessage({
                                type: 'models',
                                models: modelsByProvider
                            });
                            break;
                        }
                        case 'selectedFiles': {
                            // Handle selection updates with tokenization
                            const filesWithTokens = await Promise.all(
                                message.files.map(async (file: { path: string; isDirectory: boolean }) => ({
                                    ...file,
                                    tokenCount: file.isDirectory ? null :
                                        await this.handleFileContent(file.path, this.selectedModel)
                                }))
                            );
                            
                            this.panel?.webview.postMessage({
                                type: 'selectedFiles',
                                files: filesWithTokens
                            });
                            break;
                        }
                        case 'getFileContent': {
                            try {
                                const content = await vscode.workspace.fs.readFile(vscode.Uri.file(message.path));
                                this.panel?.webview.postMessage({
                                    type: 'fileContent',
                                    path: message.path,
                                    content: new TextDecoder().decode(content)
                                });
                            } catch (error) {
                                console.error('Error reading file:', error);
                            }
                            break;
                        }
                        case 'modelSelected':
                            this.selectedModel = message.modelId || '';
                            break;
                    }
                } catch (error) {
                    console.error('Error handling message:', error);
                    vscode.window.showErrorMessage('Failed to process request');
                }
            },
            undefined,
            this.context.subscriptions
        );

        // Add listener for selection changes
        this.fileTreeProvider.onDidChangeSelection(async files => {
            console.log('PromptPanelProvider: Selection changed, tokenizing files...');
            
            const filesWithTokens = await Promise.all(
                files.map(async file => ({
                    ...file,
                    tokenCount: file.isDirectory ? null :
                        await this.handleFileContent(file.path, this.selectedModel)
                }))
            );

            this.panel?.webview.postMessage({
                type: 'selectedFiles',
                files: filesWithTokens
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
        console.log("WE ARE HERE!");
        console.log(scriptUri);
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
            const client = new OpenAI({
                apiKey: apiKey
            });

            const list = await client.models.list();
            
            return list.data;
        } catch (error) {
            console.error('Error fetching OpenAI models:', error);
            return [];
        }
    }

    private async fetchAnthropicModels(apiKey: string): Promise<AnthropicType.ModelInfo[]> {
        try {
            console.log("IN ANTHROPIC FETCH", apiKey);
            const client = new Anthropic({
                apiKey: apiKey
            });

            const response = await client.models.list();
            console.log("HERE");
            console.log(response);
            return response.data;
        } catch (error) {
            console.error('Error fetching Anthropic models:', error);
            return [];
        }
    }

    private countTokens(text: string, modelId: string): number | null {
        try {
            const enc = encoding_for_model(modelId as TiktokenModel);
            console.log("counting tokens....");
            const tokens = enc.encode(text);
            console.log(tokens);
            const count = tokens.length;
            console.log("COUNT: ", count);
            enc.free();
            return count;
        } catch (error) {
            console.error('Error counting tokens:', error);
            return null;
        }
    }

    private getTokenizerType(modelId: string): 'openai' | 'anthropic' | null {
        console.log("getTokenizerType", modelId);
        if (modelId.startsWith('gpt-') || modelId.includes('text-davinci')) {
            return 'openai';
        } else if (modelId.startsWith('claude-')) {
            return 'anthropic';
        }
        return null;
    }

    private async handleFileContent(path: string, modelId: string): Promise<number | null> {
        try {
            console.log("CHECKPOITN handleFileContent");
            console.log(path, modelId);
            const content = await vscode.workspace.fs.readFile(vscode.Uri.file(path));
            const text = new TextDecoder().decode(content);
            const tokenizerType = this.getTokenizerType(modelId);
            console.log("handleFileContent", tokenizerType);
            if (tokenizerType === 'openai') {
                return this.countTokens(text, modelId);
            }
            return null;
        } catch (error) {
            console.error('Error reading file:', error);
            return null;
        }
    }

    public postMessageToWebview(message: WebviewMessage) {
        this.panel?.webview.postMessage(message);
    }
} 