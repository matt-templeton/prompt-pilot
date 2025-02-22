import * as vscode from 'vscode';
import * as path from 'path';
import { FileTreeProvider } from './file_tree_provider';
import { SettingsManager } from '../services/SettingsManager';
import OpenAI from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import type { Anthropic as AnthropicType } from '@anthropic-ai/sdk';
import { encoding_for_model, TiktokenModel } from "tiktoken";
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { StorageManager } from '../services/StorageManager';

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

interface WebviewPanelState {
    selectedModel: string;
    selectedFiles: { path: string; isDirectory: boolean; tokenCount: number | null }[];
}

interface VSCodeWebviewPanel extends vscode.WebviewPanel {
    state: WebviewPanelState;
}

export class PromptPanelProvider {
    public static readonly viewType = 'promptPilot.promptPanel';
    private panel: VSCodeWebviewPanel | undefined;
    private settingsManager: SettingsManager;
    private selectedModel = '';
    private storageManager: StorageManager;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly fileTreeProvider: FileTreeProvider
    ) {
        this.settingsManager = new SettingsManager(context);
        this.storageManager = StorageManager.getInstance(context);
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

        // Determine the correct extension root path based on mode
        const extensionRootPath = this.context.extensionMode === vscode.ExtensionMode.Test
            ? path.resolve(this.context.extensionPath, '..', '..')  // Go up from out/test to extension root
            : this.context.extensionPath;

        console.log("PromptPanelProvider: Extension root path:", extensionRootPath);
        const bundlePath = path.join(extensionRootPath, 'src', 'views', 'prompt-panel', 'build');
        console.log("PromptPanelProvider: Bundle path:", bundlePath);

        // Verify bundle directory exists
        if (!fs.existsSync(bundlePath)) {
            console.error(`Bundle directory not found at path: ${bundlePath}`);
            throw new Error('Bundle directory not found');
        }

        console.log("PromptPanelProvider: Creating new webview panel");
        this.panel = vscode.window.createWebviewPanel(
            PromptPanelProvider.viewType,
            'Prompt Pilot',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.file(bundlePath)
                ]
            }
        ) as VSCodeWebviewPanel;

        // Fix the HTML content setting
        console.log("PromptPanelProvider: Setting webview HTML content");
        const html = this._getWebviewContent(extensionRootPath);
        this.panel.webview.html = html;

        // Set up message handling when panel is created
        console.log("PromptPanelProvider: Setting up message handlers");
        this.panel.webview.onDidReceiveMessage(
            async message => {
                console.log("PromptPanelProvider: Received message from webview:", message);
                try {
                    switch (message.type) {
                        case 'webviewReady':
                            console.log("PromptPanelProvider: Webview reported ready");
                            break;
                        case 'getSelectedFiles': {
                            console.log("PromptPanelProvider: Handling getSelectedFiles request");
                            const files = this.fileTreeProvider.getSelectedFiles();
                            console.log("PromptPanelProvider: Sending selected files to webview:", files);
                            this.panel?.webview.postMessage({
                                type: 'selectedFiles',
                                files: files
                            });
                            break;
                        }
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
                                modelsByProvider.anthropic = await this.fetchAnthropicModels(settings.anthropicApiKey);
                            }

                            // Restore selected model from state or set default
                            const savedState = this.panel?.state;
                            const selectedModel = savedState?.selectedModel || this.getDefaultModel(modelsByProvider);

                            this.panel?.webview.postMessage({
                                type: 'models',
                                models: modelsByProvider,
                                selectedModel // Send the selected model back to the webview
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
                        case 'modelSelected': {
                            this.selectedModel = message.modelId || '';
                            // Save state when model is selected
                            if (this.panel) {
                                this.panel.state = {
                                    ...this.panel.state,
                                    selectedModel: this.selectedModel
                                };
                            }
                            break;
                        }
                        case 'retokenizeFiles': {
                            const { files, model } = message;
                            const filesWithTokens = await Promise.all(
                                files.map(async (file: { path: string; isDirectory: boolean }) => ({
                                    ...file,
                                    tokenCount: file.isDirectory ? null :
                                        await this.handleFileContent(file.path, model)
                                }))
                            );

                            this.postMessageToWebview({
                                type: 'selectedFiles',
                                files: filesWithTokens
                            });
                            break;
                        }
                        case 'extractApiSurface': {
                            await this.extractApiSurface(message.path);
                            break;
                        }
                        case 'checkApiSurface': {
                            const surface = await this.storageManager.getApiSurface(message.path);
                            if (surface) {
                                const enc = encoding_for_model('gpt-4');
                                const tokens = enc.encode(JSON.stringify(surface)).length;
                                enc.free();
                                
                                this.panel?.webview.postMessage({
                                    type: 'apiSurfaceStatus',
                                    path: message.path,
                                    exists: true,
                                    tokens
                                });
                            } else {
                                this.panel?.webview.postMessage({
                                    type: 'apiSurfaceStatus',
                                    path: message.path,
                                    exists: false
                                });
                            }
                            break;
                        }
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
        console.log("PromptPanelProvider: Setting up selection change listener");
        this.fileTreeProvider.onDidChangeSelection(async files => {
            console.log("PromptPanelProvider: Selection changed, files:", files);
            
            const filesWithTokens = await Promise.all(
                files.map(async file => ({
                    ...file,
                    tokenCount: file.isDirectory ? null :
                        await this.handleFileContent(file.path, this.selectedModel)
                }))
            );

            console.log("PromptPanelProvider: Sending updated files to webview:", filesWithTokens);
            if (this.panel) {
                this.panel.state = {
                    ...this.panel.state,
                    selectedFiles: filesWithTokens
                };
            }

            this.postMessageToWebview({
                type: 'selectedFiles',
                files: filesWithTokens
            });
        });

        // Add panel focus listener
        this.panel.onDidChangeViewState(async e => {
            if (e.webviewPanel.active) {
                const savedState = this.panel?.state;
                
                // Add debug for getSelectedFiles call
                const selectedFiles = savedState?.selectedFiles || this.fileTreeProvider.getSelectedFiles();
                
                const filesWithTokens = await Promise.all(
                    selectedFiles.map(async file => ({
                        ...file,
                        tokenCount: file.isDirectory ? null :
                            await this.handleFileContent(file.path, this.selectedModel)
                    }))
                );

                this.postMessageToWebview({
                    type: 'selectedFiles',
                    files: filesWithTokens
                });
            }
        }, null, this.context.subscriptions);

        this.panel.onDidDispose(
            () => {
                this.panel = undefined;
            },
            null,
            this.context.subscriptions
        );
    }

    private _getWebviewContent(extensionRootPath: string) {
        console.log("PromptPanelProvider: Generating webview HTML content");
        
        const bundlePath = path.join(extensionRootPath, 'src', 'views', 'prompt-panel', 'build', 'bundle.js');
        console.log("PromptPanelProvider: Bundle path:", bundlePath);

        // Verify bundle exists
        try {
            if (!fs.existsSync(bundlePath)) {
                console.error(`Bundle not found at path: ${bundlePath}`);
                throw new Error('Bundle not found');
            }
        } catch (error) {
            console.error('Error checking bundle:', error);
            throw new Error('Failed to verify bundle existence');
        }

        const scriptPathOnDisk = vscode.Uri.file(bundlePath);
        const scriptUri = this.panel!.webview.asWebviewUri(scriptPathOnDisk);
        
        console.log("PromptPanelProvider: Script URI:", scriptUri.toString());

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
                    
                    // Add ready event
                    window.addEventListener('load', () => {
                        console.log("Webview: Window loaded, sending ready message");
                        vscode.postMessage({ type: 'webviewReady' });
                    });

                    // Add error handler for script loading
                    window.addEventListener('error', (event) => {
                        console.error('Script loading error:', event);
                        vscode.postMessage({ 
                            type: 'error', 
                            error: 'Failed to load bundle: ' + event.message 
                        });
                    });
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
            const client = new Anthropic({
                apiKey: apiKey
            });

            const response = await client.models.list();
            return response.data;
        } catch (error) {
            console.error('Error fetching Anthropic models:', error);
            return [];
        }
    }

    private countTokens(text: string, modelId: string): number | null {
        try {
            const enc = encoding_for_model(modelId as TiktokenModel);
            const tokens = enc.encode(text);
            const count = tokens.length;
            enc.free();
            return count;
        } catch (error) {
            console.error('Error counting tokens:', error);
            return null;
        }
    }

    private getTokenizerType(modelId: string): 'openai' | 'anthropic' | null {
        if (modelId.startsWith('gpt-') || modelId.includes('text-davinci')) {
            return 'openai';
        } else if (modelId.startsWith('claude-')) {
            return 'anthropic';
        }
        return null;
    }

    private async handleFileContent(path: string, modelId: string): Promise<number | null> {
        try {
            const content = await vscode.workspace.fs.readFile(vscode.Uri.file(path));
            const text = new TextDecoder().decode(content);
            const tokenizerType = this.getTokenizerType(modelId);
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

    private getDefaultModel(modelsByProvider: ModelsByProvider): string {
        if (modelsByProvider.anthropic.length > 0) {
            return modelsByProvider.anthropic[0].id;
        }
        if (modelsByProvider.openai.length > 0) {
            return modelsByProvider.openai[0].id;
        }
        return '';
    }

    private async extractApiSurface(filePath: string): Promise<void> {
        try {
            // Read the surface.md prompt
            const promptPath = path.join(this.context.extensionPath, 'src', 'prompts', 'surface.md');
            const promptTemplate = await fsPromises.readFile(promptPath, 'utf-8');
            
            // Read the target file
            const fileContent = await fsPromises.readFile(filePath, 'utf-8');
            
            // Combine prompt with file content
            const fullPrompt = `${promptTemplate}\n\n<file>${fileContent}</file>`;
            
            // Get API key from settings
            // const config = vscode.workspace.getConfiguration('promptPilot');
            // const apiKey = config.get<string>('openaiApiKey');
            const settings = await this.settingsManager.getGlobalSettings();
            
            if (!settings.openaiApiKey) {
                throw new Error('OpenAI API key not configured');
            }

            // Create OpenAI client
            const openai = new OpenAI({ apiKey: settings.openaiApiKey });
            
            // Make the extraction request
            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    { 
                        role: 'user', 
                        content: fullPrompt
                    }
                ],
                temperature: 0,
            });

            // Parse the response
            if (!response.choices[0].message.content) {
                throw new Error('No content in API response');
            }
            const apiSurface = JSON.parse(response.choices[0].message.content.replace('```json', '').replace('```', ''));
            
            // Save to storage
            await this.storageManager.saveApiSurface(filePath, apiSurface);
            
            // Calculate tokens for the surface using selected model
            const tokenizerType = this.getTokenizerType(this.selectedModel);
            let surfaceTokens: number | null = null;
            
            if (tokenizerType === 'openai') {
                const enc = encoding_for_model(this.selectedModel as TiktokenModel);
                surfaceTokens = enc.encode(JSON.stringify(apiSurface)).length;
                enc.free();
            }

            // Send status back to webview
            this.panel?.webview.postMessage({
                type: 'apiSurfaceStatus',
                path: filePath,
                exists: true,
                tokens: surfaceTokens
            });

        } catch (error) {
            console.error('Error extracting API surface:', error);
            // Notify webview of failure
            this.panel?.webview.postMessage({
                type: 'apiSurfaceStatus',
                path: filePath,
                exists: false,
                error: 'Failed to extract API surface'
            });
        }
    }
} 