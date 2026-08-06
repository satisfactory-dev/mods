import {
	existsSync,
} from 'node:fs';

import {
	readFile,
	writeFile,
} from 'node:fs/promises';

import _schema from '../../schema/getMods.schema.json' with {
	type: 'json',
};

import type {
	result as _result,
} from './getMod.ts';

import type {
	result,
} from './getMod--reduced.ts';
import {
	live,
	validator,
	verify_id,
} from './getMod--reduced.ts';

import {
	stringify,
} from '../helper/json.ts';

export async function cached<
	Id extends result['id'],
>(id: Id): Promise<result<Id>> {
	if (!/^[A-Za-z0-9]+$/.test(id)) {
		throw new Error(`Id for mod does not match expected pattern: ${id}`);
	}

	const cache_file = `${
		import.meta.dirname
	}/../../.cache/api/getMod--reduced/${id}.json`;

	if (!existsSync(cache_file)) {
		const result = await live(id);

		await writeFile(cache_file, stringify(result));

		return result;
	}

	const getMod: unknown = JSON.parse((
		await readFile(cache_file)).toString(),
	);

	const shim = {data: {getMod}};

	if (!validator(shim)) {
		console.error(validator.errors);

		throw new Error(`Cached record invalid for ${id}`);
	}

	verify_id(id, shim.data.getMod);

	return shim.data.getMod;
}
