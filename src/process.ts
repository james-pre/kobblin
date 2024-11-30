import { bindContext, type BoundContext } from '@zenfs/core';
import { EventEmitter } from 'eventemitter3';
import 'ses';
import type { CompartmentOptions, ModuleDescriptor } from 'ses';
import { List } from 'utilium';

lockdown();

export class Process extends EventEmitter {
	protected compartmentOptions(): CompartmentOptions & { __options__: true } {
		const p = this;
		return {
			__options__: true,
			moduleMapHook(specifier: string): ModuleDescriptor | undefined {
				if (!specifier.startsWith('sys:')) return undefined;
				switch (specifier.slice(4)) {
					case 'fs':
						return p.fs_context;
				}
			},
			importHook(): Promise<ModuleDescriptor> {
				return;
			},
			importNowHook(): ModuleDescriptor {
				return;
			},
			get name() {
				return p.name;
			},
		};
	}

	public name?: string;

	protected compartment = new Compartment(this.compartmentOptions());

	protected readonly fs_context: BoundContext;

	public readonly children = new List<Process>();

	public constructor(
		protected code: string,
		public readonly parent?: Process
	) {
		super();
		this.fs_context = bindContext(this.parent?.fs_context.root ?? '/');
		this.compartment.evaluate(code);
	}
}
