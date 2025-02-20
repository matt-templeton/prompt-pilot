import * as vscode from 'vscode';
import * as path from 'path';

export class PromptPanelProvider {
    public static readonly viewType = 'promptPilot.promptPanel';
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
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
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.panel!.webview.cspSource} 'unsafe-inline'; script-src ${this.panel!.webview.cspSource};">
            </head>
            <body>
                <div id="root"></div>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }
} 