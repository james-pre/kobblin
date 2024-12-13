import { readFileSync } from 'node:fs';
import { parentPort, workerData } from 'node:worker_threads';
import { List } from 'utilium';

const files = workerData.files;
const functions = [],
	types = new List(),
	structs = new List(),
	enums = new List();

const attributes = [
	[/\bunsigned\b/g, 'unsigned'],
	[/\bstruct\b/g, 'struct'],
	[/\benum\b/g, 'enum'],
	[/\b__user\b/g, '__user'],
	[/\*/g, '*'],
];

for (const file of files) {
	const content = readFileSync(file, 'utf8');
	const lines = content.split('\n');

	let inSyscall = false;
	let syscallDefinition = '';

	for (const line of lines) {
		if (!inSyscall) {
			// If we're not currently parsing a syscall definition, skip until we find one.
			if (!/SYSCALL_DEFINE[0-9]*\s*\(/.test(line)) continue;
			inSyscall = true;
			syscallDefinition = line;
			continue;
		}

		syscallDefinition += ' ' + line;

		// Check if this line has the closing parenthesis of the SYSCALL_DEFINE macro
		if (!line.includes(')')) continue;
		inSyscall = false;

		// Extract the inside of the SYSCALL_DEFINE(...) parentheses
		const inside = syscallDefinition.match(/^SYSCALL_DEFINE[0-9]*\(([^)]*)\)/);

		// Reset for next potential syscall
		syscallDefinition = '';

		if (!inside?.[1]) continue;

		const tokens = inside[1]
			.split(',')
			.map(t => t.trim())
			.filter(Boolean);

		const fn = tokens[0] || '';
		if (!fn) continue;

		const argTokens = tokens.slice(1);
		const params = [];

		for (let i = 0; i < argTokens.length; i += 2) {
			const rawType = argTokens[i];
			const name = argTokens[i + 1];
			if (!name) break;

			let type = rawType;
			const comments = [];

			// Check for 'const' => remove and use 'readonly' keyword
			let readonly = false;
			if (/\bconst\b/.test(type)) {
				type = type.replace(/\bconst\b/g, '').trim();
				readonly = true;
			}

			for (const [regex, text] of attributes) {
				if (regex.test(type)) {
					type = type.replaceAll(regex, '').trim();
					comments.push(text);
				}
			}

			// Replace remaining spaces with underscores

			type = type.replace(/\s+/g, '_');
			if (!type && comments.includes('unsigned')) {
				type = 'unsigned';
				comments.splice(comments.indexOf('unsigned', 1));
			}

			if (type == 'void') type = 'unknown';

			if (comments.includes('struct')) structs.add(type);
			else if (comments.includes('enum')) enums.add(type);
			else if (type != 'unknown') types.add(type);

			type ||= 'unknown';

			const comment = !comments.length ? '' : '/* ' + comments.join(' ') + ' */ ';

			params.push({ name: name == 'new' ? 'new_' : name, type, comment, readonly });
		}

		const paramsStr = params.map(p => p.name + ': ' + p.comment + (p.readonly ? `Readonly<${p.type}>` : p.type)).join(', ');

		functions.push([fn, paramsStr]);
	}
}

parentPort?.postMessage({ functions, structs: structs.toArray(), enums: enums.toArray(), types: types.toArray() });
