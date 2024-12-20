import { bindContext, type BoundContext } from '@zenfs/core';
import { resolve } from '@zenfs/core/path';
import { EventEmitter } from 'eventemitter3';
import 'ses';
import type { CompartmentOptions, ModuleDescriptor } from 'ses';
import { List } from 'utilium';
import './fs.js';
import { so_find, so_import, so_import_async } from './so.js';
import { _import_builtin, _include, _transform_imports } from './sys.js';

lockdown();

let next_pid = 0;

export class Process extends EventEmitter {
	public readonly env: Record<string, string | undefined> = Object.create(null);

	protected compartmentOptions(): CompartmentOptions & { __options__: true } {
		const p = this;

		return {
			__options__: true,
			transforms: [_transform_imports],
			globals: { env: p.env, __include: _include.bind(p) } as any,
			resolveHook(specifier: string, referrer: string): string {
				return resolve(specifier, referrer);
			},
			moduleMapHook(specifier: string): ModuleDescriptor | undefined {
				if (!specifier.startsWith('sys:')) return undefined;
				_import_builtin(specifier.slice(4), p);
			},
			importMetaHook(specifier: string, meta: object) {
				Object.assign(meta, {
					filename: so_find(specifier, p),
				});
			},
			async importHook(specifier: string): Promise<ModuleDescriptor> {
				return so_import_async(specifier, p);
			},
			importNowHook(specifier: string): ModuleDescriptor {
				return so_import(specifier, p);
			},
			name: p.path,
		};
	}

	protected compartment: Compartment;

	public readonly fs: BoundContext;

	public readonly children = new List<Process>();

	public readonly id = next_pid++;

	public constructor(
		protected path: string,
		public readonly parent?: Process
	) {
		super();

		this.fs = bindContext(this.parent?.fs.root ?? '/');
		this.compartment = new Compartment(this.compartmentOptions());
	}

	public exec() {
		try {
			const content = this.fs.fs.readFileSync(this.path, 'utf8');
			this.compartment.evaluate(content);
		} catch (e: any) {
			console.error(e);
		}
	}
}

/**
 * @todo permissions
 */
export function spawn(this: Process | void, path: string): Process {
	return new Process(path, this ?? undefined);
}

export function exec(this: Process | void, path: string): void {
	const task = spawn.call(this, path);
	task.exec();
}
