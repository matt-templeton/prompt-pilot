declare const vscode: {
    postMessage: (message: any) => void;
};

interface Window {
    vscode: {
        postMessage: (message: any) => void;
    };
} 