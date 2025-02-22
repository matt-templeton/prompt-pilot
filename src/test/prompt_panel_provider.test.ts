import * as assert from 'assert';
import * as vscode from 'vscode';
import { FileTreeProvider } from '../providers/file_tree_provider';
import { PromptPanelProvider } from '../providers/prompt_panel_provider';

interface WebviewPanelState {
    selectedModel: string;
    selectedFiles: { path: string; isDirectory: boolean; tokenCount: number | null }[];
}

interface VSCodeWebviewPanel extends vscode.WebviewPanel {
    state: WebviewPanelState;
}

suite('Prompt Panel Provider Test Suite', () => {
    let provider: PromptPanelProvider;
    let context: vscode.ExtensionContext;
    
    suiteSetup(async () => {
        // Wait for extension to activate fully
        await vscode.extensions.getExtension('vscode-samples.prompt-pilot')?.activate();
        
        // Get the extension context
        context = {
            subscriptions: [],
            extensionPath: __dirname,
            storagePath: __dirname,
            globalStoragePath: __dirname,
            logPath: __dirname,
            // Mock other required context properties
            asAbsolutePath: (relativePath: string) => relativePath,
            storageUri: vscode.Uri.file(__dirname),
            globalStorageUri: vscode.Uri.file(__dirname),
            logUri: vscode.Uri.file(__dirname),
            extensionUri: vscode.Uri.file(__dirname),
            environmentVariableCollection: new MockEnvironmentVariableCollection(),
            extensionMode: vscode.ExtensionMode.Test,
            globalState: new MockMemento(),
            workspaceState: new MockMemento(),
            secrets: new MockSecrets(),
            extension: {
                id: 'test',
                extensionUri: vscode.Uri.file(__dirname),
                extensionPath: __dirname,
                isActive: true,
                packageJSON: {},
                exports: undefined,
                activate: () => Promise.resolve(),
                extensionKind: vscode.ExtensionKind.Workspace
            },
            languageModelAccessInformation: undefined as unknown as vscode.LanguageModelAccessInformation
        };
    });

    setup(() => {
        // Create new provider instance before each test
        const fileTreeProvider = FileTreeProvider.getInstance();
        provider = new PromptPanelProvider(context, fileTreeProvider);
    });

    test('Prompt panel opens successfully', async () => {
        // Initial state - verify no panel exists
        assert.strictEqual(provider['panel'], undefined, 'Should start with no panel');

        // Show the panel
        await provider.showPanel();

        // Verify panel exists
        const panel = provider['panel'];
        assert.ok(panel, 'Panel should exist');

        // Now that we know panel exists, we can safely assert its type and check properties
        const webviewPanel = panel as VSCodeWebviewPanel;
        assert.strictEqual(webviewPanel.viewType, 'promptPilot.promptPanel', 'Panel should have correct viewType');
    });

    teardown(() => {
        // Close any open panels
        if (provider['panel']) {
            provider['panel'].dispose();
        }
    });
});

// Mock classes for context properties
class MockMemento implements vscode.Memento {
    private storage = new Map<string, unknown>();

    get<T>(key: string): T | undefined;
    get<T>(key: string, defaultValue: T): T;
    get(key: string, defaultValue?: unknown): unknown {
        return this.storage.get(key) ?? defaultValue;
    }

    update(key: string, value: unknown): Thenable<void> {
        this.storage.set(key, value);
        return Promise.resolve();
    }

    keys(): readonly string[] {
        return Array.from(this.storage.keys());
    }

    setKeysForSync(_keys: readonly string[]): void {
        // No-op in mock
    }
}

class MockSecrets implements vscode.SecretStorage {
    private storage = new Map<string, string>();

    get(key: string): Thenable<string | undefined> {
        return Promise.resolve(this.storage.get(key));
    }

    store(key: string, value: string): Thenable<void> {
        this.storage.set(key, value);
        return Promise.resolve();
    }

    delete(key: string): Thenable<void> {
        this.storage.delete(key);
        return Promise.resolve();
    }

    onDidChange = new vscode.EventEmitter<vscode.SecretStorageChangeEvent>().event;
}

class MockEnvironmentVariableCollection implements vscode.EnvironmentVariableCollection {
    private variables = new Map<string, vscode.EnvironmentVariableMutator>();
    persistent = true;
    description = 'Mock environment variables';
    
    replace(_variable: string, _value: string): void {
        // No-op in mock
    }

    append(_variable: string, _value: string): void {
        // No-op in mock
    }

    prepend(_variable: string, _value: string): void {
        // No-op in mock
    }

    get(_variable: string): vscode.EnvironmentVariableMutator | undefined {
        return undefined;
    }

    forEach(_callback: (variable: string, mutator: vscode.EnvironmentVariableMutator, collection: vscode.EnvironmentVariableCollection) => void, _thisArg?: unknown): void {
        // No-op in mock
    }

    delete(_variable: string): void {
        // No-op in mock
    }

    clear(): void {
        // No-op in mock
    }

    getScoped(_scope: vscode.EnvironmentVariableScope): vscode.EnvironmentVariableCollection {
        return this;
    }

    *[Symbol.iterator](): IterableIterator<[string, vscode.EnvironmentVariableMutator]> {
        yield* this.variables.entries();
    }
} 