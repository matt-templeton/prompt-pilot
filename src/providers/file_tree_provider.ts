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
        const path = item.resourceUri.fsPath;
        const isDirectory = fs.statSync(path).isDirectory();

        if (this.selectedFiles.has(path)) {
            // If unselecting a directory, remove all its files too
            if (isDirectory) {
                const allFiles = await this.getAllFilesInDirectory(path);
                allFiles.forEach(file => this.selectedFiles.delete(file));
            }
            this.selectedFiles.delete(path);
            item.updateCheckboxState(false);
        } else {
            // If selecting a directory, add all its files too
            if (isDirectory) {
                const allFiles = await this.getAllFilesInDirectory(path);
                allFiles.forEach(file => this.selectedFiles.add(file));
            }
            this.selectedFiles.add(path);
            item.updateCheckboxState(true);
        }

        this._onDidChangeTreeData.fire();
        this._onDidChangeSelection.fire(this.getSelectedFiles());
    }

    refresh(): void {
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
            
            // Filter files based on search query
            const filteredFiles = this.searchQuery 
                ? sortedFiles.filter(([name]) => 
                    name.toLowerCase().includes(this.searchQuery.toLowerCase()))
                : sortedFiles;
            
            return filteredFiles.map(([name, type]) => {
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

                // Update the command to only pass the resource URI
                item.command = {
                    command: 'promptPilot.toggleSelection',
                    title: 'Toggle Selection',
                    arguments: [resourceUri.fsPath]
                };
                
                return item;
            });
        } catch (error) {
            console.error('Error reading directory:', error);
            return [];
        }
    }

    // Modify getSelectedFiles to include directory information
    public getSelectedFiles(): { path: string; isDirectory: boolean }[] {
        const selectedFiles = Array.from(this.selectedFiles.entries())
            .filter(([_, isSelected]) => isSelected)
            .map(([path]) => ({
                path,
                isDirectory: fs.statSync(path).isDirectory()
            }));
        return selectedFiles;
    }

    // Add new method to uncheck item by path
    async uncheckItemByPath(filePath: string): Promise<void> {
        if (this.selectedFiles.has(filePath)) {
            this.selectedFiles.delete(filePath);
            
            // Find and update the corresponding TreeItem
            const items = await this.findTreeItemByPath(filePath);
            items.forEach(item => item.updateCheckboxState(false));
            
            this._onDidChangeTreeData.fire();
            this._onDidChangeSelection.fire(this.getSelectedFiles());
        }
    }

    // Helper method to find TreeItem by path
    private async findTreeItemByPath(targetPath: string): Promise<FileTreeItem[]> {
        const items: FileTreeItem[] = [];
        
        // Helper function to search recursively
        const searchInItems = async (parentItem?: FileTreeItem) => {
            const children = await this.getChildren(parentItem);
            for (const item of children) {
                if (item.resourceUri.fsPath === targetPath) {
                    items.push(item);
                }
                if (item.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed ||
                    item.collapsibleState === vscode.TreeItemCollapsibleState.Expanded) {
                    await searchInItems(item);
                }
            }
        };

        await searchInItems();
        return items;
    }

    dispose() {
        this.fileWatcher.dispose();
    }
} 