import {
	glob,
} from 'node:fs/promises';

import {
	basename,
} from 'node:path';

import {
	freshness_validator,
} from './getMod.ts';

import type {
	result,
} from './getMod--reduced.ts';
import {
	schema as _schema,
	cached as single_record,
	sub_query,
} from './getMod--reduced.ts';

import Ajv from '../helper/ajv.ts';

import {
	cached as bulk_record_cached,
	live as bulk_record_live,
} from './helper/bulk-record.ts';

const schema = {
	..._schema,
	properties: {
		..._schema.properties,
		data: {
			..._schema.properties.data,
			required: ['getMods'],
			properties: {
				getMods: {
					type: 'object',
					required: ['mods'],
					unevaluatedProperties: false,
					properties: {
						mods: {
							type: 'array',
							items: _schema.properties.data.properties.getMod,
						},
					},
				},
			},
		},
	},
};

export const validator = Ajv.compile<{
	data: {
		getMods: {
			mods: result[],
		},
	},
}>(schema);

export async function* live<
	Id extends result['id'],
>(
	ids: Iterable<Id>|AsyncIterable<Id>,
): AsyncGenerator<result> {
	yield* bulk_record_live<result>(
		'getMods',
		'mods',
		sub_query,
		ids,
		validator,
	);
}

export async function* cached<
	Id extends result['id'],
>(
	ids: Iterable<Id>|AsyncIterable<Id>,
) {
	yield* bulk_record_cached<result>(
		'getMods',
		'mods',
		sub_query,
		ids,
		ids_in_cache(),
		single_record,
		validator,
		freshness_validator,
		'getMod--reduced',
	);
}

export async function* ids_in_cache(): AsyncGenerator<result['id']> {
	for await (const path of glob(`${
		import.meta.dirname
	}/../../.cache/api/getMod--reduced/*.json`)) {
		yield basename(path, '.json');
	}
}
