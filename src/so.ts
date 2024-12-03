/* Code for handling shared objects / libraries */
import './fs.js';
import { fs as _fs, ErrnoError, errorMessages, type Stats } from '@zenfs/core';
import type { Process } from './process.js';
import { X_OK } from '@zenfs/core/emulation/constants.js';
import type { ModuleDescriptor } from 'ses';

const _isLibLinkedToUsr = false;

const so_regex = /^(lib)?(?<base>.+)\.(?<extension>so|js)(?<version>(\.\d+)*)$/;

function so_get_paths(ld_library_path?: string): string[] {
	return [...(ld_library_path?.split(':') ?? []), '/usr/lib', '/usr/lib64', !_isLibLinkedToUsr && '/lib', !_isLibLinkedToUsr && '/lib64'];
}

export function so_find(specifier: string, process: Partial<Process> = {}): string | undefined {
	const { env = Object.create(null) } = process;
	const fs = process.fs?.fs || _fs;
	const [specifierBase, specifierVersion] = specifier.split('@');

	for (const path of so_get_paths(env.LD_LIBRARY_PATH)) {
		if (!path) continue;

		let entries: string[] | undefined;
		try {
			entries = fs.readdirSync(path);
		} catch {
			continue;
		}

		for (const name of entries) {
			const match = name.match(so_regex);
			if (!match) continue;
			const fullPath = path + '/' + name;

			let stats: Stats | undefined;
			try {
				stats = fs.statSync(fullPath);
			} catch {
				continue;
			}

			if (!stats.isFile() || !stats.hasAccess(X_OK)) continue;

			const { base, version } = match.groups!;

			if (base != specifierBase) continue;

			if (!specifierVersion) return fullPath;

			if (version?.endsWith('.' + specifierVersion) ?? true) return fullPath;
		}
	}
}

export async function so_find_async(specifier: string, process: Partial<Process> = {}): Promise<string | undefined> {
	const { env = Object.create(null) } = process;
	const fs = process.fs?.fs || _fs;
	const [specifierBase, specifierVersion] = specifier.split('@');

	for (const path of so_get_paths(env.LD_LIBRARY_PATH)) {
		if (!path) continue;

		const entries = await fs.promises.readdir(path).catch(() => null);
		if (!entries) continue;

		for (const name of entries) {
			const match = name.match(so_regex);
			if (!match) continue;
			const fullPath = path + '/' + name;

			const stats = await fs.promises.stat(fullPath).catch(() => null);
			if (!stats?.isFile() || !stats.hasAccess(X_OK)) continue;

			const { base, version } = match.groups!;

			if (base !== specifierBase) continue;

			if (!specifierVersion) return fullPath;

			if (version?.endsWith('.' + specifierVersion) ?? true) return fullPath;
		}
	}
}

export function so_import(specifier: string, process: Process): ModuleDescriptor {
	try {
		const path = so_find(specifier, process);

		if (!path) throw ErrnoError.With('ENOENT');

		const source = process.fs.fs.readFileSync(path, 'utf-8');

		return {
			source,
			specifier,
			importMeta: {
				filename: path,
			},
		};
	} catch (e: any) {
		const prefix = 'error while loading shared libraries: ' + specifier + ': ';
		if (e instanceof ErrnoError) throw prefix + errorMessages[e.errno];
		throw prefix + e.toString();
	}
}

export async function so_import_async(specifier: string, process: Process): Promise<ModuleDescriptor> {
	try {
		const path = await so_find_async(specifier, process);

		if (!path) throw ErrnoError.With('ENOENT');

		const source = await process.fs.fs.promises.readFile(path, 'utf-8');

		return {
			source,
			specifier,
			importMeta: {
				filename: path,
			},
		};
	} catch (e: any) {
		const prefix = 'error while loading shared libraries: ' + specifier + ': ';
		if (e instanceof ErrnoError) throw prefix + errorMessages[e.errno];
		throw prefix + e.toString();
	}
}
