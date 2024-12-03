/* eslint-disable @typescript-eslint/consistent-type-imports */
// Built-in modules and globals

declare function __include(specifier: string): any;

declare module 'kernel' {
	global {
		function printk(level: import('sys:log').Log, message: string): void;
	}
}

declare module 'sys:log' {
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

	export function syslog(severity: Log, message: string): void;
}

declare module 'sys:fs' {
	export * from '@zenfs/core/emulation/index.js';
}
