// Manages the File Explorer panel UI
// Combines TreeView, search, and filter components
// Handles user interactions with the file selection interface 
import * as vscode from 'vscode';
import { FileTreeProvider } from '../providers/file_tree_provider';

export function createFileExplorerView(fileTreeProvider: FileTreeProvider) {
    const treeView = vscode.window.createTreeView('promptPilotExplorer', {
        treeDataProvider: fileTreeProvider,
        showCollapseAll: true,
        canSelectMany: true,
    });

    // Add checkbox state change listener
    treeView.onDidChangeCheckboxState(event => {
        console.log('TreeView: Checkbox state changed event triggered');
        console.log('TreeView: Changed items:', event.items.map(([item, state]) => ({
            label: item.label,
            path: item.resourceUri.fsPath,
            state: state === vscode.TreeItemCheckboxState.Checked ? 'Checked' : 'Unchecked'
        })));
        
        event.items.forEach(([item, state]) => {
            const checked = state === vscode.TreeItemCheckboxState.Checked;
            console.log('TreeView: Setting item', item.label, 'to', checked);
            console.log('TreeView: Item path:', item.resourceUri.fsPath);
            console.log('TreeView: Item current checkbox state:', item.checkboxState);
            console.log('TreeView: Item current isChecked:', item.isChecked);
            
            // Update the item's checkbox state through our provider
            console.log('TreeView: Calling fileTreeProvider.toggleSelection');
            fileTreeProvider.toggleSelection(item);
        });
    });

    return {
        treeView,
        fileTreeProvider,
        dispose: () => {
            treeView.dispose();
        }
    };
}