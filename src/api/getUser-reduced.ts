import {
	basename,
} from 'node:path';

import {
	existsSync,
} from 'node:fs';

import {
	glob,
	readFile,
	writeFile,
} from 'node:fs/promises';

import Ajv from '../helper/ajv.ts';

import type image_url from './helper/image-url.ts';

import run from './helper/run.ts';

import validated from './helper/validated.ts';

import schema from '../../schema/getUser-reduced.schema.json' with {
	type: 'json',
};

import type {
	result as getMod,
} from './getMod.ts';

import {
	stringify,
} from '../helper/json.ts';

export type result<
	Id extends Exclude<string, ''> = Exclude<string, ''>,
> = (
	& {
		id: Id,
		username: Exclude<string, ''>,
		avatar: image_url<'users', 'avatar', Id>,
		mods: {
			mod_id: getMod['id'],
		}[],
	}
);

export const validator = Ajv.compile<{
	data: {
		getUser: result,
	},
}>(schema);

function verify_id<
	Id extends result['id'],
>(
	id: Id,
	result: result,
): asserts result is result<Id> {
	if (result.id !== id) {
		throw new Error(`Expected ${id}, got ${result.id}`);
	}
}

export const sub_query = `id
	username
	avatar
	mods {
		mod_id
	}`;

export async function live<
	Id extends result['id'],
>(id: Id): Promise<result<Id>> {
	const result = validated(validator, await run(
		`getUser(userId: ${
			JSON.stringify(id)
		})`,
		sub_query,
	)).data.getUser;

	verify_id(id, result);

	return result;
}

export async function cached<
	Id extends result['id'],
>(id: Id): Promise<result<Id>> {
	if (!/^[A-Za-z0-9]+$/.test(id)) {
		throw new Error(`Id for mod does not match expected pattern: ${id}`);
	}

	const cache_file = `${
		import.meta.dirname
	}/../../.cache/api/getUser-reduced/${id}.json`;

	if (!existsSync(cache_file)) {
		const result = await live(id);

		await writeFile(cache_file, stringify(result));

		return result;
	}

	const getUser: unknown = JSON.parse((
		await readFile(cache_file)).toString(),
	);

	const shim = {data: {getUser}};

	if (!validator(shim)) {
		console.error(validator.errors);

		throw new Error(`Cached record invalid for ${id}`);
	}

	verify_id(id, shim.data.getUser);

	return shim.data.getUser;
}

export async function* ids_in_cache(): AsyncGenerator<result['id']> {
	for await (const path of glob(`${
		import.meta.dirname
	}/../../.cache/api/getUser-reduced/*.json`)) {
		yield basename(path, '.json');
	}
}
