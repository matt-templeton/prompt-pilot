import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';
import * as path from 'path';
import { FileTreeProvider, FileTreeItem } from '../providers/file_tree_provider';

interface SelectedPath {
	path: string;
	isDirectory: boolean;
}

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});
});

suite('File Explorer Tests', () => {
	let provider: FileTreeProvider;

	setup(() => {
		// Use getInstance instead of new constructor
		provider = FileTreeProvider.getInstance();
		
		// Update to handle SelectedPath type
		provider.getSelectedFiles().forEach((selectedPath: SelectedPath) => {
			provider.toggleSelection(new FileTreeItem(
				path.basename(selectedPath.path),
				vscode.TreeItemCollapsibleState.None,
				vscode.Uri.file(selectedPath.path),
				true
			));
		});
	});

	test('FileTreeProvider initialization', () => {
		assert.ok(provider, 'Provider should be initialized');
		assert.strictEqual(provider.getSelectedFiles().length, 0, 'Should start with no selected files');
	});

	test('FileTreeItem checkbox state', () => {
		const uri = vscode.Uri.file(path.join(__dirname, 'test.txt'));
		const item = new FileTreeItem(
			'test.txt',
			vscode.TreeItemCollapsibleState.None,
			uri,
			false
		);

		assert.strictEqual(
			item.checkboxState,
			vscode.TreeItemCheckboxState.Unchecked,
			'Should start unchecked'
		);

		item.updateCheckboxState(true);
		assert.strictEqual(
			item.checkboxState,
			vscode.TreeItemCheckboxState.Checked,
			'Should be checked after update'
		);
	});

	test('Search functionality', async () => {
		// Only run if we have a workspace folder
		if (!vscode.workspace.workspaceFolders) {
			return;
		}

		// Set a search query
		provider.setSearchQuery('extension');

		// Wait for search to complete
		await new Promise(resolve => setTimeout(resolve, 1000));

		// Get children (search results)
		const results = await provider.getChildren();

		assert.ok(
			results.some(item => item.label.toLowerCase().includes('extension')),
			'Search should find files containing "extension"'
		);
	});

	test('File selection toggle', async () => {
		if (!vscode.workspace.workspaceFolders) {
			return;
		}

		const rootFiles = await provider.getChildren();
		assert.ok(rootFiles.length > 0, 'Should have some files in workspace');

		const firstFile = rootFiles[0];
		provider.toggleSelection(firstFile);

		const selectedFiles = provider.getSelectedFiles();
		assert.strictEqual(selectedFiles.length, 1, 'Should have one selected file');
		assert.strictEqual(
			selectedFiles[0].path,  // Update to access path property
			firstFile.resourceUri.fsPath,
			'Selected file should match toggled file'
		);

		provider.toggleSelection(firstFile);
		assert.strictEqual(
			provider.getSelectedFiles().length,
			0,
			'Should have no selected files after toggle off'
		);
	});

	test('Directory structure', async () => {
		if (!vscode.workspace.workspaceFolders) {
			return;
		}

		// Get root items
		const rootItems = await provider.getChildren();
		
		// Find a directory
		const directory = rootItems.find(item => 
			item.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed);
		
		if (directory) {
			// Get children of directory
			const children = await provider.getChildren(directory);
			assert.ok(children.length >= 0, 'Directory should be readable');
			
			// Verify children are properly constructed
			children.forEach(child => {
				assert.ok(child.label, 'Child should have a label');
				assert.ok(child.resourceUri, 'Child should have a resource URI');
				assert.ok(
					child.checkboxState === vscode.TreeItemCheckboxState.Checked ||
					child.checkboxState === vscode.TreeItemCheckboxState.Unchecked,
					'Child should have a valid checkbox state'
				);
			});
		}
	});

	test('File watcher updates', async () => {
		if (!vscode.workspace.workspaceFolders) {
			return;
		}

		// Create a temporary file
		const tmpFile = vscode.Uri.file(
			path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'test-temp.txt')
		);

		try {
			// Create file
			await vscode.workspace.fs.writeFile(tmpFile, Buffer.from('test'));
			
			// Wait for watcher to detect
			await new Promise(resolve => setTimeout(resolve, 1000));
			
			// Get root items
			const rootItems = await provider.getChildren();
			
			// Check if new file is listed
			assert.ok(
				rootItems.some(item => item.resourceUri.fsPath === tmpFile.fsPath),
				'New file should be detected'
			);

		} finally {
			// Cleanup
			try {
				await vscode.workspace.fs.delete(tmpFile);
			} catch (e) {
				console.error('Error cleaning up test file:', e);
			}
		}
	});

	// Add new test for singleton behavior
	test('Singleton pattern', () => {
		const instance1 = FileTreeProvider.getInstance();
		const instance2 = FileTreeProvider.getInstance();
		assert.strictEqual(instance1, instance2, 'Should return the same instance');
	});
});
