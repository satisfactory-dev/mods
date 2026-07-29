import {
	createWriteStream,
	existsSync,
} from 'node:fs';

import {
	basename,
} from 'node:path';

import {
	glob,
	readFile,
	unlink,
} from 'node:fs/promises';

import paginated from './helper/paginated.ts';

import schema from '../../schema/getMods.schema.json' with {
	type: 'json',
};

import type {
	result,
} from './getMod.ts';

type return_type = AsyncGenerator<result['id']>;

export async function* live(): return_type {
	for await (const mod of paginated<{
		id: result['id'],
	}>(
		'getMods',
		'mods',
		'id',
		schema,
	)) {
		yield mod.id;
	}
}

export async function* cached(): return_type {
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
			if (existsSync(cache_file)) {
				await unlink(cache_file);
			}

			throw err;
		}
	} else {
		const contents = await readFile(cache_file);

		for (const id of JSON.parse(contents.toString())) {
			yield id;
		}
	}
}

export async function* from_single_record(): return_type {
	for await (const path of glob(`${
		import.meta.dirname
	}/../../.cache/api/getMods/records/*.json`)) {
		yield basename(path, '.json');
	}
}

export async function from_single_record_as_set(): Promise<Set<result['id']>> {
	const result = new Set<result['id']>();

	for await (const id of from_single_record()) {
		result.add(id);
	}

	return result;
}
