// Manages the File Explorer panel UI
// Combines TreeView, search, and filter components
// Handles user interactions with the file selection interface 
import * as vscode from 'vscode';
import { FileTreeProvider } from '../providers/file_tree_provider';

export function createFileExplorerView() {
    const fileTreeProvider = new FileTreeProvider();
    const treeView = vscode.window.createTreeView('promptPilotExplorer', {
        treeDataProvider: fileTreeProvider,
        showCollapseAll: true,
        canSelectMany: true,
    });

    return {
        treeView,
        fileTreeProvider,
        dispose: () => {
            treeView.dispose();
            // fileTreeProvider.dispose();
        }
    };
}