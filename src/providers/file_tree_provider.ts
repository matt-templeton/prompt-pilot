// Implements TreeDataProvider for VSCode's TreeView
// Handles the file/folder structure display with checkboxes
// Manages file selection state and updates 

import * as vscode from 'vscode';
import * as path from 'path';
import { debounce } from '../utils';
import * as fs from 'fs';

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
        
        // Update this line to use the enum value directly
        this.checkboxState = isChecked 
            ? vscode.TreeItemCheckboxState.Checked 
            : vscode.TreeItemCheckboxState.Unchecked;
    }

    // Update this method to use the enum value directly
    updateCheckboxState(checked: boolean) {
        this.isChecked = checked;
        this.checkboxState = checked 
            ? vscode.TreeItemCheckboxState.Checked 
            : vscode.TreeItemCheckboxState.Unchecked;
    }
}

// Add this interface
interface SelectedPath {
  path: string;
  isDirectory: boolean;
}

export class FileTreeProvider implements vscode.TreeDataProvider<FileTreeItem> {
    private static instance: FileTreeProvider;
    private _onDidChangeTreeData = new vscode.EventEmitter<FileTreeItem | undefined | null | void>();
    private _onDidChangeSelection = new vscode.EventEmitter<SelectedPath[]>();
    
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
    readonly onDidChangeSelection = this._onDidChangeSelection.event;

    private fileWatcher: vscode.FileSystemWatcher;
    private selectedFiles = new Set<string>();
    private searchQuery = '';
    private currentSearchResults: [string, vscode.FileType][] = [];
    private isSearching = false;

    private constructor() {
        // Make constructor private for singleton
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
        this.fileWatcher.onDidCreate(() => this.refresh());
        this.fileWatcher.onDidDelete(() => this.refresh());
        this.fileWatcher.onDidChange(() => this.refresh());
    }

    public static getInstance(): FileTreeProvider {
        if (!FileTreeProvider.instance) {
            FileTreeProvider.instance = new FileTreeProvider();
        }
        return FileTreeProvider.instance;
    }

    // Add this new helper method
    private async getAllFilesInDirectory(dirPath: string): Promise<string[]> {
        const files: string[] = [];
        try {
            const dirEntries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
            
            for (const [name, type] of dirEntries) {
                const fullPath = path.join(dirPath, name);
                if (type === vscode.FileType.Directory) {
                    // Recursively get files from subdirectory
                    const subDirFiles = await this.getAllFilesInDirectory(fullPath);
                    files.push(...subDirFiles);
                } else {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            console.error('Error reading directory:', error);
        }
        return files;
    }

    // Update toggle selection method
    async toggleSelection(item: FileTreeItem): Promise<void> {
        console.log('FileTreeProvider: Starting toggle selection for:', item.label);
        console.log('FileTreeProvider: Before toggle - selected files:', Array.from(this.selectedFiles));
        console.log('FileTreeProvider: Item checkbox state before toggle:', item.checkboxState);
        console.log('FileTreeProvider: Item isChecked before toggle:', item.isChecked);
        
        const path = item.resourceUri.fsPath;
        const isDirectory = fs.statSync(path).isDirectory();

        if (this.selectedFiles.has(path)) {
            // If unselecting a directory, remove all its files too
            if (isDirectory) {
                console.log('FileTreeProvider: Unselecting directory and its contents:', path);
                const allFiles = await this.getAllFilesInDirectory(path);
                allFiles.forEach(file => {
                    console.log('FileTreeProvider: Removing directory child from selectedFiles:', file);
                    this.selectedFiles.delete(file);
                });
            }
            console.log('FileTreeProvider: Removing path from selectedFiles:', path);
            this.selectedFiles.delete(path);
            item.updateCheckboxState(false);
        } else {
            // If selecting a directory, add all its files too
            if (isDirectory) {
                console.log('FileTreeProvider: Selecting directory and its contents:', path);
                const allFiles = await this.getAllFilesInDirectory(path);
                allFiles.forEach(file => {
                    console.log('FileTreeProvider: Adding directory child to selectedFiles:', file);
                    this.selectedFiles.add(file);
                });
            }
            console.log('FileTreeProvider: Added path to selectedFiles:', path);
            this.selectedFiles.add(path);
            item.updateCheckboxState(true);
        }

        console.log('FileTreeProvider: After toggle - selected files:', Array.from(this.selectedFiles));
        console.log('FileTreeProvider: Item checkbox state after toggle:', item.checkboxState);
        console.log('FileTreeProvider: Item isChecked after toggle:', item.isChecked);

        this._onDidChangeTreeData.fire();
        console.log('FileTreeProvider: Fired onDidChangeTreeData event');
        
        const selectedFiles = this.getSelectedFiles();
        console.log('FileTreeProvider: Firing onDidChangeSelection with files:', selectedFiles);
        this._onDidChangeSelection.fire(selectedFiles);
    }

    refresh(): void {
        console.log('FileTreeProvider: refresh called, firing onDidChangeTreeData event');
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: FileTreeItem): vscode.TreeItem {
        return element;
    }

    // Add new method to recursively get all files
    private async getAllFilesRecursively(folderUri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        const results: [string, vscode.FileType][] = [];
        
        try {
            const files = await vscode.workspace.fs.readDirectory(folderUri);
            
            for (const [name, type] of files) {
                if (type === vscode.FileType.Directory) {
                    // For directories, recursively get their contents
                    const subFolderUri = vscode.Uri.joinPath(folderUri, name);
                    const subFiles = await this.getAllFilesRecursively(subFolderUri);
                    
                    // Add directory itself
                    results.push([name, type]);
                    
                    // Add subfiles with their relative paths
                    for (const [subName, subType] of subFiles) {
                        const relativePath = path.join(name, subName);
                        results.push([relativePath, subType]);
                    }
                } else {
                    results.push([name, type]);
                }
            }
        } catch (error) {
            console.error('Error reading directory:', error);
        }
        
        return results;
    }

    // Add this method to yield results as they're found
    private async *findFilesGenerator(folderUri: vscode.Uri, searchQuery: string): AsyncGenerator<[string, vscode.FileType]> {
        try {
            const files = await vscode.workspace.fs.readDirectory(folderUri);
            
            // First yield files in current directory (breadth-first)
            for (const [name, type] of files) {
                if (name.toLowerCase().includes(searchQuery.toLowerCase())) {
                    yield [name, type];
                }
            }

            // Then recursively search subdirectories
            for (const [name, type] of files) {
                if (type === vscode.FileType.Directory) {
                    const subFolderUri = vscode.Uri.joinPath(folderUri, name);
                    for await (const [subName, subType] of this.findFilesGenerator(subFolderUri, searchQuery)) {
                        const relativePath = path.join(name, subName);
                        yield [relativePath, subType];
                    }
                }
            }
        } catch (error) {
            console.error('Error reading directory:', error);
        }
    }

    // Add method to handle incremental search updates
    private async performIncrementalSearch(searchQuery: string) {
        if (!vscode.workspace.workspaceFolders) {
            return;
        }

        this.isSearching = true;
        this.currentSearchResults = [];
        const rootPath = vscode.workspace.workspaceFolders[0].uri;

        // Start the generator
        const generator = this.findFilesGenerator(rootPath, searchQuery);
        
        // Process results in chunks and update the view
        const updateView = debounce(() => {
            this._onDidChangeTreeData.fire();
        }, 100); // Debounce updates to prevent too frequent refreshes

        for await (const result of generator) {
            if (this.searchQuery !== searchQuery) {
                // Search query changed while we were searching
                break;
            }
            this.currentSearchResults.push(result);
            updateView();
        }

        this.isSearching = false;
        this._onDidChangeTreeData.fire(); // Final update
    }

    // Update the setSearchQuery method
    setSearchQuery(query: string) {
        this.searchQuery = query;
        if (query) {
            this.performIncrementalSearch(query);
        } else {
            this.currentSearchResults = [];
            this.refresh();
        }
    }

    // Update getChildren to use currentSearchResults
    async getChildren(element?: FileTreeItem): Promise<FileTreeItem[]> {
        console.log('FileTreeProvider: getChildren called with element:', element?.label);
        try {
            if (!element) {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders) {
                    return Promise.resolve([]);
                }
                const rootPath = workspaceFolders[0].uri;

                if (this.searchQuery) {
                    // Return current search results
                    return this.currentSearchResults.map(([name, type]) => {
                        const resourceUri = vscode.Uri.joinPath(rootPath, name);
                        const label = path.basename(name);
                        const collapsibleState = type === vscode.FileType.Directory 
                            ? vscode.TreeItemCollapsibleState.Collapsed 
                            : vscode.TreeItemCollapsibleState.None;

                        const item = new FileTreeItem(
                            label,
                            collapsibleState,
                            resourceUri,
                            this.selectedFiles.has(resourceUri.fsPath)
                        );

                        const relativePath = path.dirname(name);
                        if (relativePath !== '.') {
                            item.description = relativePath;
                        }

                        item.command = {
                            command: 'promptPilot.toggleSelection',
                            title: 'Toggle Selection',
                            arguments: [resourceUri.fsPath]
                        };

                        return item;
                    });
                } else {
                    return this.getFilesInFolder(rootPath);
                }
            } else {
                return this.getFilesInFolder(element.resourceUri);
            }
        } catch (error) {
            console.error('Error in getChildren:', error);
            return [];
        }
    }

    private async getFilesInFolder(folderUri: vscode.Uri): Promise<FileTreeItem[]> {
        console.log('FileTreeProvider: getFilesInFolder called for folder:', folderUri.fsPath);
        try {
            const result: FileTreeItem[] = [];
            const entries = await vscode.workspace.fs.readDirectory(folderUri);
            
            // Sort entries: directories first, then files, both alphabetically
            entries.sort((a, b) => {
                const [aName, aType] = a;
                const [bName, bType] = b;
                
                // If types are different, directories come first
                if (aType !== bType) {
                    return aType === vscode.FileType.Directory ? -1 : 1;
                }
                
                // If types are the same, sort alphabetically
                return aName.localeCompare(bName);
            });
            
            for (const [name, type] of entries) {
                // Skip hidden files and directories
                if (name.startsWith('.')) {
                    continue;
                }
                
                const uri = vscode.Uri.joinPath(folderUri, name);
                const isDirectory = type === vscode.FileType.Directory;
                
                // Create tree item
                const item = new FileTreeItem(
                    name,
                    isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                    uri,
                    this.selectedFiles.has(uri.fsPath)
                );
                
                // Add command to toggle selection
                item.command = {
                    command: 'promptPilot.toggleSelection',
                    title: 'Toggle Selection',
                    arguments: [uri.fsPath]
                };
                
                result.push(item);
            }
            
            console.log('FileTreeProvider: Found files in folder:', result.map(item => ({
                label: item.label,
                path: item.resourceUri.fsPath,
                checked: item.checkboxState === vscode.TreeItemCheckboxState.Checked
            })));
            
            return result;
        } catch (error) {
            console.error('Error reading directory:', error);
            return [];
        }
    }

    // Modify getSelectedFiles to include directory information
    public getSelectedFiles(): { path: string; isDirectory: boolean }[] {
        console.log('FileTreeProvider: getSelectedFiles called');
        console.log('FileTreeProvider: Current selectedFiles set:', Array.from(this.selectedFiles));
        
        const selectedFiles = Array.from(this.selectedFiles)
            .map(path => ({
                path,
                isDirectory: fs.statSync(path).isDirectory()
            }));
        
        console.log('FileTreeProvider: Returning selectedFiles:', selectedFiles);
        return selectedFiles;
    }

    // Add new method to uncheck item by path
    async uncheckItemByPath(filePath: string): Promise<void> {
        console.log('FileTreeProvider: uncheckItemByPath called for path:', filePath);
        console.log('FileTreeProvider: Before uncheck - selected files:', Array.from(this.selectedFiles));
        
        const wasSelected = this.selectedFiles.has(filePath);
        console.log('FileTreeProvider: Path was in selectedFiles?', wasSelected);
        
        if (wasSelected) {
            console.log('FileTreeProvider: Path found in selectedFiles, removing it');
            this.selectedFiles.delete(filePath);
            
            // Find and update the corresponding TreeItem
            console.log('FileTreeProvider: Finding TreeItems for path:', filePath);
            const items = await this.findTreeItemByPath(filePath);
            console.log('FileTreeProvider: Found TreeItems:', items.map(item => ({ 
                label: item.label, 
                checked: item.checkboxState === vscode.TreeItemCheckboxState.Checked 
            })));
            
            items.forEach(item => {
                console.log('FileTreeProvider: Updating checkbox state for item:', item.label);
                item.updateCheckboxState(false);
                console.log('FileTreeProvider: Item checkbox state after update:', item.checkboxState);
            });
            
            console.log('FileTreeProvider: Firing onDidChangeTreeData event');
            this._onDidChangeTreeData.fire();
            
            const selectedFiles = this.getSelectedFiles();
            console.log('FileTreeProvider: After uncheck - selected files:', selectedFiles);
            console.log('FileTreeProvider: Firing onDidChangeSelection with files:', selectedFiles);
            this._onDidChangeSelection.fire(selectedFiles);
        } else {
            console.log('FileTreeProvider: Path not found in selectedFiles:', filePath);
        }
    }

    // Helper method to find TreeItem by path
    private async findTreeItemByPath(targetPath: string): Promise<FileTreeItem[]> {
        console.log('FileTreeProvider: findTreeItemByPath called for path:', targetPath);
        const items: FileTreeItem[] = [];
        
        // Helper function to search recursively
        const searchInItems = async (parentItem?: FileTreeItem) => {
            console.log('FileTreeProvider: searchInItems called with parent:', parentItem?.label);
            const children = await this.getChildren(parentItem);
            console.log('FileTreeProvider: Found children:', children.map(item => ({
                label: item.label,
                path: item.resourceUri.fsPath,
                checked: item.checkboxState === vscode.TreeItemCheckboxState.Checked
            })));
            
            for (const item of children) {
                console.log('FileTreeProvider: Checking item:', item.label, item.resourceUri.fsPath);
                if (item.resourceUri.fsPath === targetPath) {
                    console.log('FileTreeProvider: Found matching item:', item.label);
                    items.push(item);
                }
                if (item.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed ||
                    item.collapsibleState === vscode.TreeItemCollapsibleState.Expanded) {
                    console.log('FileTreeProvider: Searching in directory:', item.label);
                    await searchInItems(item);
                }
            }
        };

        await searchInItems();
        console.log('FileTreeProvider: findTreeItemByPath found items:', items.map(item => ({
            label: item.label,
            path: item.resourceUri.fsPath,
            checked: item.checkboxState === vscode.TreeItemCheckboxState.Checked
        })));
        return items;
    }

    dispose() {
        this.fileWatcher.dispose();
    }
} 