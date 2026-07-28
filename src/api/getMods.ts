import {
	createWriteStream,
	existsSync,
} from 'node:fs';

import {
	readFile,
	unlink,
} from 'node:fs/promises';

import paginated from './helper/paginated.ts';

export type result = AsyncGenerator<number>;

export async function* live(): result {
	for await (const mod of paginated(
		'getMods',
		'mods',
		'id',
	)) {
		yield mod.id;
	}
}

export async function* cached(): result {
	const cache_file = `${
		import.meta.dirname
	}/../../.cache/api/getMods/ids.json`;

	if (!existsSync(cache_file)) {
		const buff = createWriteStream(cache_file);

		buff.write('[\n');

		let comma = false;

		try {
			for await (const id of live()) {
				yield id;

				if (comma) {
					buff.write(',\n');
				} else {
					comma = true;
				}

				buff.write(`\t${JSON.stringify(id)}`);
			}

			buff.write('\n]\n');

			buff.close();
		} catch (err) {
			await unlink(cache_file);

			throw err;
		}
	} else {
		const contents = await readFile(cache_file);

		for (const id of JSON.parse(contents.toString())) {
			yield id;
		}
	}
}
