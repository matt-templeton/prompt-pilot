// Implements TreeDataProvider for VSCode's TreeView
// Handles the file/folder structure display with checkboxes
// Manages file selection state and updates 

import * as vscode from 'vscode';
// import * as path from 'path';

export class FileTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly resourceUri: vscode.Uri,
        public isChecked = false
    ) {
        super(label, collapsibleState);
        this.resourceUri = resourceUri;
        this.contextValue = 'file';
        
        // Set the checkbox state property correctly
        this.checkboxState = {
            state: isChecked ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked
        };
    }

    // Method to update checkbox state
    updateCheckboxState(checked: boolean) {
        this.isChecked = checked;
        this.checkboxState = {
            state: checked ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked
        };
    }
}

export class FileTreeProvider implements vscode.TreeDataProvider<FileTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<FileTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    private fileWatcher: vscode.FileSystemWatcher;
    private selectedFiles = new Set<string>();

    constructor() {
        // Create a file system watcher
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
        
        // Watch for file changes
        this.fileWatcher.onDidCreate(() => this.refresh());
        this.fileWatcher.onDidDelete(() => this.refresh());
        this.fileWatcher.onDidChange(() => this.refresh());
    }

    // Update toggle selection method
    toggleSelection(item: FileTreeItem): void {
        const path = item.resourceUri.fsPath;
        if (this.selectedFiles.has(path)) {
            this.selectedFiles.delete(path);
            item.updateCheckboxState(false);
        } else {
            this.selectedFiles.add(path);
            item.updateCheckboxState(true);
        }
        this._onDidChangeTreeData.fire();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: FileTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: FileTreeItem): Promise<FileTreeItem[]> {
        if (!element) {
            // Root of the workspace
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                return Promise.resolve([]);
            }
            const rootPath = workspaceFolders[0].uri;
            const children = await this.getFilesInFolder(rootPath);
            return children;
        } else {
            // Get children of the folder
            return await this.getFilesInFolder(element.resourceUri);
        }
    }

    private async getFilesInFolder(folderUri: vscode.Uri): Promise<FileTreeItem[]> {
        try {
            const files = await vscode.workspace.fs.readDirectory(folderUri);
            
            // Sort files: directories first, then files, both alphabetically
            const sortedFiles = files.sort((a, b) => {
                const [nameA, typeA] = a;
                const [nameB, typeB] = b;
                
                // If one is a directory and the other isn't, directory comes first
                if (typeA === vscode.FileType.Directory && typeB !== vscode.FileType.Directory) {
                    return -1;
                }
                if (typeA !== vscode.FileType.Directory && typeB === vscode.FileType.Directory) {
                    return 1;
                }
                
                // If both are the same type, sort alphabetically
                return nameA.toLowerCase().localeCompare(nameB.toLowerCase());
            });
            
            return sortedFiles.map(([name, type]) => {
                const resourceUri = vscode.Uri.joinPath(folderUri, name);
                const collapsibleState = type === vscode.FileType.Directory 
                    ? vscode.TreeItemCollapsibleState.Collapsed 
                    : vscode.TreeItemCollapsibleState.None;
                
                const item = new FileTreeItem(
                    name,
                    collapsibleState,
                    resourceUri,
                    this.selectedFiles.has(resourceUri.fsPath)
                );

                // Add click handler
                item.command = {
                    command: 'promptPilot.toggleSelection',
                    title: 'Toggle Selection',
                    arguments: [item]
                };
                
                return item;
            });
        } catch (error) {
            console.error('Error reading directory:', error);
            return [];
        }
    }

    // Add method to get selected files
    getSelectedFiles(): string[] {
        return Array.from(this.selectedFiles);
    }

    dispose() {
        this.fileWatcher.dispose();
    }
} 