// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { createFileExplorerView } from './views/file_explorer_view';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "helloworld-sample" is now active!');

	// Create and register the file explorer view
    const fileExplorer = createFileExplorerView();
    
    // Register the toggle command
    const toggleCommand = vscode.commands.registerCommand('promptRepo.toggleSelection', 
        (item) => fileExplorer.fileTreeProvider.toggleSelection(item));

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

	context.subscriptions.push(fileExplorer, disposable, toggleCommand, searchCommand, refreshCommand);

}
