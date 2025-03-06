// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { createFileExplorerView } from './views/file_explorer_view';
import { PromptPanelProvider } from './providers/prompt_panel_provider';
import { FileTreeProvider, FileTreeItem } from './providers/file_tree_provider';
import * as path from 'path';
import * as fs from 'fs';
import { OpenAI } from 'openai';
import type { Anthropic as AnthropicType } from '@anthropic-ai/sdk';
import { StorageManager } from './services/StorageManager';

interface OpenAIModel {
	id: string;
	created: number;
	owned_by: string;
}

interface ModelsByProvider {
	openai: OpenAIModel[];
	anthropic: AnthropicType.ModelInfo[];
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated

	// Initialize storage manager
	try {
		// In test mode, wait for test setup to initialize StorageManager
		if (context.extensionMode !== vscode.ExtensionMode.Test) {
			const storageManager = StorageManager.getInstance(context);
			await storageManager.initialize();
		}
	} catch (error) {
		console.error('Failed to initialize storage manager:', error);
	}

	// Get singleton instance of FileTreeProvider
	const fileTreeProvider = FileTreeProvider.getInstance();
	
	// Create and register the file explorer view
	const fileExplorer = createFileExplorerView(fileTreeProvider);
	
	// Create and register the prompt panel provider with injected dependencies
	const promptPanelProvider = new PromptPanelProvider(context, fileTreeProvider);
	
	
	// Add this function to fetch OpenAI models
	async function fetchAllModels(apiKey: string): Promise<ModelsByProvider> {
		const modelsByProvider: ModelsByProvider = {
			openai: [],
			anthropic: []
		};
		
		try {
			const client = new OpenAI({
				apiKey: apiKey
			});
			modelsByProvider.openai = (await client.models.list()).data;
		} catch (error) {
			console.error('Error fetching OpenAI models:', error);
		}

		return modelsByProvider;
	}

	// Update the configuration change handler
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(async (e) => {
			if (e.affectsConfiguration('promptPilot.openaiApiKey')) {
				const config = vscode.workspace.getConfiguration('promptPilot');
				const apiKey = config.get<string>('openaiApiKey') || '';
				const anthropicApiKey = config.get<string>('anthropicApiKey') || '';
				console.log(anthropicApiKey, apiKey);
				if (apiKey) {
					console.log("Fetching all models...");
					const modelsByProvider = await fetchAllModels(apiKey);
					promptPanelProvider.postMessageToWebview({
						type: 'models',
						models: modelsByProvider
					});
				}
			}
		})
	);
	
	// Subscribe to selection changes
	fileTreeProvider.onDidChangeSelection(files => {
		console.log('Extension: Selection changed event triggered');
		console.log('Extension: Files in selection change event:', files);
		console.log('Extension: Number of selected files:', files.length);
	});
	
	// Register commands
	const openPromptPanelCommand = vscode.commands.registerCommand('promptPilot.openPromptPanel', () => {
		promptPanelProvider.showPanel();
	});

	// Register the toggle command
	const toggleCommand = vscode.commands.registerCommand(
		'promptPilot.toggleSelection', 
		async (fsPath: string) => {
			console.log('Toggle command: Called with path:', fsPath);
			console.log('Toggle command: Type of fsPath:', typeof fsPath);
			
			let filePath: string = fsPath;
			
			// Handle case where fsPath is an object with resourceUri
			if (typeof fsPath === 'object') {
				const resourceObj = fsPath as { resourceUri?: { fsPath: string } };
				if (resourceObj.resourceUri) {
					console.log('Toggle command: fsPath is an object with resourceUri:', resourceObj.resourceUri);
					filePath = resourceObj.resourceUri.fsPath;
				}
			}
			
			const uri = vscode.Uri.file(filePath);
			console.log('Toggle command: Created URI:', uri.fsPath);
			
			// Get all items from the tree
			const rootItems = await fileExplorer.fileTreeProvider.getChildren();
			console.log('Toggle command: All root items:', rootItems.map(i => ({ 
				label: i.label, 
				checked: i.checkboxState === vscode.TreeItemCheckboxState.Checked 
			})));

			const item = rootItems.find(i => i.resourceUri.fsPath === filePath);
			
			if (item) {
				console.log('Toggle command: Found existing item:', {
					label: item.label,
					checked: item.checkboxState === vscode.TreeItemCheckboxState.Checked
				});
				// Update the item's checkbox state
				item.updateCheckboxState(!item.isChecked);
				console.log('Toggle command: Updated checkbox state:', {
					label: item.label,
					checked: item.checkboxState === vscode.TreeItemCheckboxState.Checked
				});
				
				// Toggle selection in the provider
				await fileExplorer.fileTreeProvider.toggleSelection(item);

				// Log TreeView state after toggle
				console.log('Toggle command: TreeView selection:', fileExplorer.treeView.selection.map(i => i.label));
				console.log('Toggle command: Selected files after toggle:', 
					(await fileExplorer.fileTreeProvider.getChildren())
						.filter(i => i.checkboxState === vscode.TreeItemCheckboxState.Checked)
						.map(i => i.label)
				);
			} else {
				console.log('Creating new item for:', filePath);
				// If not found at root, create a new item
				const newItem = new FileTreeItem(
					path.basename(filePath),
					fs.statSync(filePath).isDirectory() 
						? vscode.TreeItemCollapsibleState.Collapsed 
						: vscode.TreeItemCollapsibleState.None,
					uri
				);
				await fileExplorer.fileTreeProvider.toggleSelection(newItem);
			}
		}
	);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World!');
	});

	// Register the search command
	const searchCommand = vscode.commands.registerCommand('promptRepo.searchFiles', async () => {
		const quickPick = vscode.window.createQuickPick();
		quickPick.placeholder = 'Search files...';
		
		// Update search results as user types
		quickPick.onDidChangeValue(value => {
			fileExplorer.fileTreeProvider.setSearchQuery(value);
		});

		// Clean up when quick pick is closed
		quickPick.onDidHide(() => {
			quickPick.dispose();
		});

		quickPick.show();
	});

	// Register the refresh command
	const refreshCommand = vscode.commands.registerCommand('promptRepo.refresh', () => {
		fileExplorer.fileTreeProvider.setSearchQuery(''); // Clear search
		fileExplorer.fileTreeProvider.refresh(); // Refresh view
	});

	context.subscriptions.push(
		fileExplorer, 
		disposable, 
		toggleCommand, 
		searchCommand, 
		refreshCommand,
		openPromptPanelCommand
	);

}
