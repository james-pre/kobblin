import type { Process } from './process.js';

export enum Log {
	/** Emergency */
	EMERG,
	/** Alert */
	ALERT,
	/** Critical */
	CRIT,
	/** Error */
	ERR,
	/** Warning */
	WARN,
	/** Notice */
	NOTICE,
	/** Informational */
	INFO,
	/** Debug */
	DEBUG,
}

const builtin_so_regex = /<([^>]+)>/;

export function _import_builtin(specifier: string, process: Process) {
	switch (specifier) {
		case 'fs':
			return process.fs.fs;
		case 'log':
			return harden({
				syslog(severity: Log, message: string): void {
					console.log(`[${Log[severity].toLowerCase()}]`, message);
				},
			});
	}
}

/**
 * Importable by PID 0
 */
export function _import_kernel(this: Process) {
	if (this.id != 0) return;

	Object.assign(
		this.compartment.globalThis,
		harden({
			Log,
			printk(level: Log, message: string) {
				console.log(`kernel: [${Log[level].toLowerCase()}]`, message);
			},
		})
	);
}

const _transform_imports_regex = /^import\s+((\*\s+as\s+(\w+))|(\{[^}]*\})|(\w+))?\s*from\s*['"]([^'"]+)['"];?|^import\s+['"]([^'"]+)['"];?/gm;

export function _transform_imports(text: string): string {
	return text.replaceAll(_transform_imports_regex, (match, _, namespace, nsName, namedImports, defaultImport, fromModule, sideEffectModule) => {
		if (sideEffectModule) return `__include('${sideEffectModule}');`;
		if (namespace) return `const ${nsName} = __include('${fromModule}');`;
		if (namedImports) return `const ${namedImports} = __include('${fromModule}');`;
		if (defaultImport) return `const ${defaultImport} = __include('${fromModule}');`;
		return match; // Default case, should never be hit if all import cases are handled.
	});
}

export function _include(this: Process, specifier: string) {
	if (specifier.startsWith('sys:')) return _import_builtin(specifier.slice(4), this);
	if (specifier == 'kernel') return _import_kernel.call(this);

	const match = specifier.match(builtin_so_regex);

	return match ? _import_builtin(match[1], this) : this.compartment.importNow(specifier);
}
