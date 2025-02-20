interface VSCodeMessage {
    type: 'getSelectedFiles' | 'toggleFileSelection' | 'selectedFiles';
    files?: string[];
    file?: string;
}

declare function acquireVsCodeApi(): {
    postMessage(message: VSCodeMessage): void;
    setState(state: VSCodeMessage): void;
    getState(): VSCodeMessage | undefined;
};

declare const vscode: ReturnType<typeof acquireVsCodeApi>;

interface Window {
    vscode: {
        postMessage: (message: VSCodeMessage) => void;
    };
} 