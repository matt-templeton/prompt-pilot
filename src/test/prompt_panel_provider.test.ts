import * as assert from 'assert';
import * as vscode from 'vscode';
import { FileTreeProvider, FileTreeItem } from '../providers/file_tree_provider';
import { PromptPanelProvider } from '../providers/prompt_panel_provider';
import * as path from 'path';
// import * as fs from 'fs';
import { createTestExtensionContext, getTestStoragePath } from './test-utils';
import { StorageManager } from '../services/StorageManager';
import { createFileExplorerView } from '../views/file_explorer_view';

// interface WebviewPanelState {
//     selectedModel: string;
//     selectedFiles: { path: string; isDirectory: boolean; tokenCount: number | null }[];
// }

// interface VSCodeWebviewPanel extends vscode.WebviewPanel {
//     state: WebviewPanelState;
// }

interface WebviewMessage {
    type: string;
    files?: { path: string; isDirectory: boolean }[];
}

suite('Prompt Panel Provider Test Suite', () => {
    let provider: PromptPanelProvider;
    let context: vscode.ExtensionContext;
    let fileTreeProvider: FileTreeProvider;
    let fileExplorer: { treeView: vscode.TreeView<FileTreeItem>; fileTreeProvider: FileTreeProvider; dispose: () => void };
    let testFiles: { path: string; isDirectory: boolean }[];
    let testStoragePath: string;
    
    suiteSetup(async () => {
        // Reset StorageManager instance
        StorageManager.resetInstance();

        // Get test storage path
        testStoragePath = getTestStoragePath();
        
        // Wait for extension to activate fully
        await vscode.extensions.getExtension('vscode-samples.prompt-pilot')?.activate();
        
        // Get the workspace folder
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(workspaceFolder, 'Workspace folder should be available');
        
        // Create test files in workspace
        const test1Path = path.join(workspaceFolder.uri.fsPath, 'test1.ts');
        const test2Path = path.join(workspaceFolder.uri.fsPath, 'test2.ts');
        const testDirPath = path.join(workspaceFolder.uri.fsPath, 'testDir');
        
        // Create test files
        await vscode.workspace.fs.writeFile(vscode.Uri.file(test1Path), Buffer.from('console.log("test1");'));
        await vscode.workspace.fs.writeFile(vscode.Uri.file(test2Path), Buffer.from('console.log("test2");'));
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(testDirPath));
        
        testFiles = [
            { path: test1Path, isDirectory: false },
            { path: test2Path, isDirectory: false },
            { path: testDirPath, isDirectory: true }
        ];
        
        // Get the extension context
        context = createTestExtensionContext();

        // Initialize StorageManager with test path
        const storageManager = StorageManager.getInstance(context, testStoragePath);
        await storageManager.initialize();
    });

    setup(() => {
        // Create new provider instances before each test
        fileTreeProvider = FileTreeProvider.getInstance();
        fileExplorer = createFileExplorerView(fileTreeProvider);
        provider = new PromptPanelProvider(context, fileTreeProvider);
    });

    test('Selected files are displayed in FileExplorerBox', async function() {
        this.timeout(20000); // Increase to 30 seconds

        console.log('Test starting: Selected files are displayed in FileExplorerBox');

        // Show the panel first
        await provider.showPanel();
        console.log('Panel shown, exists:', !!provider['panel']);

        // Create a promise that will resolve when the message is received
        const messagePromise = new Promise<WebviewMessage>((resolve) => {
            console.log('Setting up message listener');
            provider['panel']!.webview.onDidReceiveMessage(
                (message: WebviewMessage) => {
                    console.log('Received message from webview:', message);
                    if (message.type === 'selectedFiles' && message.files?.length === testFiles.length) {
                        resolve(message);
                    }
                },
                undefined,
                context.subscriptions
            );
        });

        // Wait for panel to be ready and webview to initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('Panel ready after delay');

        // Refresh the tree view to see the new files
        fileTreeProvider.refresh();
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get the root items from the TreeView
        const rootItems = await fileTreeProvider.getChildren();
        console.log('Root items:', rootItems.map(item => item.label));

        // Simulate checkbox selection for each test file
        for (const file of testFiles) {
            const filename = path.basename(file.path);
            const item = rootItems.find(i => i.label === filename);
            assert.ok(item, `Could not find TreeItem for ${filename}`);

            // Use our improved toggleSelection command
            console.log('Toggling selection for:', filename);
            await vscode.commands.executeCommand('promptPilot.toggleSelection', file.path);
            
            // Add a small delay to allow the event to propagate
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('All files selected, waiting for message');

        try {
            // Wait for the message to be received
            const message = await messagePromise;
            console.log('Message received:', message);
            
            // Verify the files in the message match our test files
            assert.ok(message.files, 'Message should contain files');
            assert.strictEqual(message.files.length, testFiles.length, 'Should have correct number of files');
            
            // Verify each file is present
            for (const testFile of testFiles) {
                const found = message.files.some(file => 
                    path.normalize(file.path) === path.normalize(testFile.path) && 
                    file.isDirectory === testFile.isDirectory
                );
                assert.ok(found, `File ${testFile.path} should be present in the message`);
            }
        } catch (error) {
            console.error('Error in test:', error);
            throw error;
        }
    });

    teardown(() => {
        // Close any open panels
        if (provider['panel']) {
            provider['panel'].dispose();
        }
        fileExplorer.dispose();
    });

    suiteTeardown(async () => {
        // Clean up test files
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                for (const file of testFiles) {
                    await vscode.workspace.fs.delete(vscode.Uri.file(file.path), { recursive: true });
                }
            }
        } catch (error) {
            console.error('Error cleaning up test files:', error);
        }
    });
}); 