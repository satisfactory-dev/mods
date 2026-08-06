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
	sub_query,
} from './getMod--reduced.ts';

import {
	cached as single_record,
} from './getMod--reduced.cached.ts';

import type {
	SchemaObject,
	ValidateFunction,
} from '../helper/ajv.ts';

import {
	cached as bulk_record_cached,
	live as bulk_record_live,
} from './helper/bulk-record.ts';

export function compile_schema(): SchemaObject {
	return {
		..._schema,
		$id: 'getMods--reduced',
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
								items: (
									_schema.properties.data.properties.getMod
								),
							},
						},
					},
				},
			},
		},
	};
}

export type schema_type = {
	data: {
		getMods: {
			mods: result[],
		},
	},
};

export function get_validator(): Promise<ValidateFunction<schema_type>> {
	return import(
		'../../.cache/getMods--reduced.validator.ts',
	).then((e) => e.default as ValidateFunction<schema_type>);
}

export async function* live<
	Id extends result['id'],
>(
	ids: Iterable<Id>|AsyncIterable<Id>,
): AsyncGenerator<result> {
	const validator = await get_validator();

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
	const validator = await get_validator();

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
