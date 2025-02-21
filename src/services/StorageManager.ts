import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { ApiSurface, ApiSurfaceCache, CacheManifest } from '../types/storage';

export class StorageManager {
    private static instance: StorageManager;
    private storagePath: vscode.Uri;
    private surfacesPath: vscode.Uri;
    private manifest: CacheManifest;
    private readonly CACHE_VERSION = '1.0.0';
    private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

    private constructor(private context: vscode.ExtensionContext) {
        this.storagePath = vscode.Uri.joinPath(
            context.storageUri || context.globalStorageUri,
            'prompt-pilot-data'
        );
        this.surfacesPath = vscode.Uri.joinPath(this.storagePath, 'api-surfaces');
        this.manifest = {
            version: this.CACHE_VERSION,
            entries: {}
        };
    }

    public static getInstance(context: vscode.ExtensionContext): StorageManager {
        if (!StorageManager.instance) {
            StorageManager.instance = new StorageManager(context);
        }
        return StorageManager.instance;
    }

    public async initialize(): Promise<void> {
        try {
            await vscode.workspace.fs.createDirectory(this.surfacesPath);
            await this.loadManifest();
            this.setupFileWatcher();
        } catch (error) {
            console.error('Failed to initialize StorageManager:', error);
            throw error;
        }
    }

    private async loadManifest(): Promise<void> {
        const manifestPath = vscode.Uri.joinPath(this.storagePath, 'manifest.json');
        try {
            const manifestData = await vscode.workspace.fs.readFile(manifestPath);
            this.manifest = JSON.parse(manifestData.toString());
            
            // Version check and migration if needed
            if (this.manifest.version !== this.CACHE_VERSION) {
                await this.migrateCache(this.manifest.version);
            }
        } catch (error) {
            // If manifest doesn't exist, create a new one
            console.error('No manifest found, creating new one:', error);
            await this.saveManifest();
        }
    }

    private async saveManifest(): Promise<void> {
        const manifestPath = vscode.Uri.joinPath(this.storagePath, 'manifest.json');
        const manifestData = JSON.stringify(this.manifest, null, 2);
        await vscode.workspace.fs.writeFile(manifestPath, Buffer.from(manifestData));
    }

    private setupFileWatcher(): void {
        const watcher = vscode.workspace.createFileSystemWatcher('**/*');
        
        watcher.onDidChange(async uri => {
            await this.invalidateCache(uri.fsPath);
        });
        
        watcher.onDidDelete(async uri => {
            await this.invalidateCache(uri.fsPath);
        });

        this.context.subscriptions.push(watcher);
    }

    public async getApiSurface(filePath: string): Promise<ApiSurface | null> {
        try {
            const hash = this.manifest.entries[filePath];
            if (!hash) {
                return null;
            }

            const surfacePath = vscode.Uri.joinPath(this.surfacesPath, `${hash}.json`);
            const surfaceData = await vscode.workspace.fs.readFile(surfacePath);
            const cache: ApiSurfaceCache = JSON.parse(surfaceData.toString());

            // Check if cache is still valid
            if (Date.now() - cache.timestamp > this.CACHE_TTL) {
                await this.invalidateCache(filePath);
                return null;
            }

            // Verify file hasn't changed
            const currentHash = await this.hashFile(filePath);
            if (currentHash !== cache.hash) {
                await this.invalidateCache(filePath);
                return null;
            }

            return cache.surface;
        } catch (error) {
            console.error('Error reading API surface:', error);
            return null;
        }
    }

    public async saveApiSurface(filePath: string, surface: ApiSurface): Promise<void> {
        try {
            const hash = await this.hashFile(filePath);
            const cache: ApiSurfaceCache = {
                timestamp: Date.now(),
                hash,
                surface
            };

            const surfacePath = vscode.Uri.joinPath(this.surfacesPath, `${hash}.json`);
            await vscode.workspace.fs.writeFile(
                surfacePath,
                Buffer.from(JSON.stringify(cache, null, 2))
            );

            this.manifest.entries[filePath] = hash;
            await this.saveManifest();
        } catch (error) {
            console.error('Error saving API surface:', error);
            throw error;
        }
    }

    public async invalidateCache(filePath: string): Promise<void> {
        const hash = this.manifest.entries[filePath];
        if (hash) {
            try {
                const surfacePath = vscode.Uri.joinPath(this.surfacesPath, `${hash}.json`);
                await vscode.workspace.fs.delete(surfacePath);
            } catch (error) {
                console.error('Error deleting surface file:', error);
            }

            delete this.manifest.entries[filePath];
            await this.saveManifest();
        }
    }

    private async hashFile(filePath: string): Promise<string> {
        try {
            const fileContent = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
            return crypto
                .createHash('sha256')
                .update(fileContent)
                .digest('hex');
        } catch (error) {
            console.error('Error hashing file:', error);
            throw error;
        }
    }

    private async migrateCache(fromVersion: string): Promise<void> {
        // Implement cache migration logic here when needed
        console.log(`Migrating cache from version ${fromVersion} to ${this.CACHE_VERSION}`);
        
        // For now, just update the version and save
        this.manifest.version = this.CACHE_VERSION;
        await this.saveManifest();
    }
} 