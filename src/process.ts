import { bindContext, type BoundContext } from '@zenfs/core';
import 'ses';

function __import() {}

export class Process {
	protected compartment: Compartment = new Compartment({
		globals: {
			__import,
		},
	});

	protected fs_context: BoundContext;

	public constructor(public readonly parent?: Process) {
		this.fs_context = bindContext('/');
	}
}
