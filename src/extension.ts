// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { createFileExplorerView } from './views/file_explorer_view';
import { PromptPanelProvider } from './providers/prompt_panel_provider';
import { FileTreeProvider, FileTreeItem } from './providers/file_tree_provider';
import * as path from 'path';
import * as fs from 'fs';

interface OpenAIModel {
	id: string;
	created: number;
	owned_by: string;
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "helloworld-sample" is now active!');

	// Get singleton instance of FileTreeProvider
	const fileTreeProvider = FileTreeProvider.getInstance();
	
	// Create and register the file explorer view
	const fileExplorer = createFileExplorerView(fileTreeProvider);
	
	// Create and register the prompt panel provider with injected dependencies
	const promptPanelProvider = new PromptPanelProvider(context, fileTreeProvider);
	
	// Add this function to fetch OpenAI models
	async function fetchOpenAIModels(apiKey: string): Promise<OpenAIModel[]> {
		try {
			const response = await fetch('https://api.openai.com/v1/models', {
				headers: {
					'Authorization': `Bearer ${apiKey}`,
					'Content-Type': 'application/json'
				}
			});
			
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			
			const data = await response.json();
			return data.data;
		} catch (error) {
			console.error('Error fetching OpenAI models:', error);
			return [];
		}
	}

	// Add this to handle model fetching
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(async (e) => {
			if (e.affectsConfiguration('promptPilot.openaiApiKey')) {
				const config = vscode.workspace.getConfiguration('promptPilot');
				const apiKey = config.get<string>('openaiApiKey') || '';
				if (apiKey) {
					const models = await fetchOpenAIModels(apiKey);
					promptPanelProvider.postMessageToWebview({
						type: 'models',
						models: models
					});
				}
			}
		})
	);
	
	// Subscribe to selection changes
	fileTreeProvider.onDidChangeSelection(files => {
		console.log('Extension: Selection changed:', files);
	});
	
	// Register commands
	const openPromptPanelCommand = vscode.commands.registerCommand('promptPilot.openPromptPanel', () => {
		promptPanelProvider.showPanel();
	});

	// Register the toggle command
	const toggleCommand = vscode.commands.registerCommand(
		'promptPilot.toggleSelection', 
		async (fsPath: string) => {
			const uri = vscode.Uri.file(fsPath);
			const item = new FileTreeItem(
				path.basename(fsPath),
				fs.statSync(fsPath).isDirectory() 
					? vscode.TreeItemCollapsibleState.Collapsed 
					: vscode.TreeItemCollapsibleState.None,
				uri
			);
			await fileExplorer.fileTreeProvider.toggleSelection(item);
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
