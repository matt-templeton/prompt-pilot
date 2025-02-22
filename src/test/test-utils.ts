import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export async function setupTestWorkspace() {
    // Create test workspace directory if it doesn't exist
    const workspacePath = path.join(__dirname, 'test-workspace');
    if (!fs.existsSync(workspacePath)) {
        fs.mkdirSync(workspacePath, { recursive: true });
    }

    // Create a workspace configuration
    const workspaceFile = path.join(workspacePath, 'test.code-workspace');
    const workspaceConfig = {
        folders: [{ path: '.' }],
        settings: {}
    };

    fs.writeFileSync(workspaceFile, JSON.stringify(workspaceConfig, null, 2));

    // Open the workspace
    await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspacePath));

    // Wait for workspace to be fully loaded
    await new Promise(resolve => setTimeout(resolve, 1000));

    return workspacePath;
}

export async function cleanupTestWorkspace(workspacePath: string) {
    try {
        // Delete all files in the workspace
        const files = fs.readdirSync(workspacePath);
        for (const file of files) {
            const filePath = path.join(workspacePath, file);
            fs.rmSync(filePath, { recursive: true, force: true });
        }
    } catch (error) {
        console.error('Error cleaning up test workspace:', error);
    }
}

export function getTestStoragePath(): string {
    // Create a consistent test storage path
    const testStorageRoot = path.join(os.homedir(), '.vscode-test', 'prompt-pilot-test-data');
    
    // Create the main directory and subdirectories
    const directories = [
        testStorageRoot,
        path.join(testStorageRoot, 'api-surfaces')
    ];
    
    // Ensure all directories exist
    for (const dir of directories) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
    
    return testStorageRoot;
}

export function createTestExtensionContext(): vscode.ExtensionContext {
    const storagePath = getTestStoragePath();
    return {
        subscriptions: [],
        extensionPath: __dirname,
        storagePath: storagePath,
        globalStoragePath: storagePath,
        logPath: storagePath,
        asAbsolutePath: (relativePath: string) => path.join(__dirname, relativePath),
        extensionUri: vscode.Uri.file(__dirname),
        environmentVariableCollection: new MockEnvironmentVariableCollection(),
        extensionMode: vscode.ExtensionMode.Test,
        globalState: new MockMemento(),
        workspaceState: new MockMemento(),
        secrets: new MockSecrets(),
        storageUri: vscode.Uri.file(storagePath),
        globalStorageUri: vscode.Uri.file(storagePath),
        logUri: vscode.Uri.file(storagePath),
        extension: {
            id: 'vscode-samples.prompt-pilot',
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
}

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