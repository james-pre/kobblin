// Built-in kernel modules and globals

declare function __kwrite(data: string): void;

declare function __include(specifier: string): any;

declare module 'sys:fs' {
	export * from '@zenfs/core/emulation/index.js';
}
