type MessageType = 'getSettings' | 'settings' | 'updateSettings' | 'getSelectedFiles' | 'toggleFileSelection' | 'selectedFiles';

interface WebviewMessage {
    type: MessageType;
    settings?: {
        openaiApiKey?: string;
        anthropicApiKey?: string;
    };
    files?: {path: string; isDirectory: boolean}[];
    file?: string;
    action?: 'check' | 'uncheck';
}

interface VSCodeState {
    settings?: WebviewMessage['settings'];
    selectedFiles?: WebviewMessage['files'];
}

interface VSCodeAPI {
    postMessage(message: WebviewMessage): void;
    getState(): VSCodeState;
    setState(state: VSCodeState): void;
}

declare function acquireVsCodeApi(): VSCodeAPI;
declare const vscode: ReturnType<typeof acquireVsCodeApi>;
interface Window {
    vscode: {
        postMessage: (message: WebviewMessage) => void;
    };
} 