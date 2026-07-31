import {
	existsSync,
} from 'node:fs';

import {
	basename,
} from 'node:path';

import {
	glob,
	readFile,
} from 'node:fs/promises';

import Ajv from './helper/ajv.ts';

import {
	cached as bulk_record_cached,
	live as bulk_record_live,
} from './helper/bulk-record.ts';

import schema from '../../schema/getTags.schema.json' with {
	type: 'json',
};

export type result<
	Id extends Exclude<string, ''> = Exclude<string, ''>,
> = {
	id: Id,
	name: Exclude<string, ''>,
	description: Exclude<string, ''>,
};

export const validator = Ajv.compile<{
	data: {
		getTags: result[],
	},
}>(schema);

export async function* ids_in_cache(): AsyncGenerator<result['id']> {
	for await (const path of glob(`${
		import.meta.dirname
	}/../../.cache/api/getTags/*.json`)) {
		yield basename(path, '.json');
	}
}

const sub_query = `id
	name
	description`;

export async function* live<
	Id extends result['id'],
>(
	ids: Iterable<Id>|AsyncIterable<Id>,
): AsyncGenerator<result> {
	yield* bulk_record_live<result>(
		'getTags',
		undefined,
		sub_query,
		ids,
		validator,
	);
}

function verify_id<
	Id extends result['id'],
>(
	id: Id,
	possibly: result,
): asserts possibly is result<Id> {
	if (possibly.id !== id) {
		throw new Error('Tag id mismatch!');
	}
}

async function single_record<
	Id extends result['id'],
>(id: Id): Promise<result<Id>> {
	if (!/^[A-Za-z0-9]+$/.test(id)) {
		throw new Error(`Id for record does not match expected pattern: ${
			id
		}`);
	}

	const cache_file = `${
		import.meta.dirname
	}/../../.cache/api/getTags/${id}.json`;

	if (!existsSync(cache_file)) {
		throw new Error(`Cannot fetch single record for non-cached item!`);
	}

	const result: unknown = JSON.parse((
		await readFile(cache_file)).toString(),
	);

	const shim = {data: {
		getTags: [result],
	}};

	if (!validator(shim)) {
		console.error(validator.errors);

		throw new Error(`Cached record invalid for ${id}`);
	}

	verify_id(id, shim.data.getTags[0]);

	return shim.data.getTags[0];
}

export async function* cached<
	Id extends result['id'],
>(
	ids: Iterable<Id>|AsyncIterable<Id>,
) {
	yield* bulk_record_cached<result>(
		'getTags',
		undefined,
		sub_query,
		ids,
		ids_in_cache(),
		single_record,
		validator,
	);
}
