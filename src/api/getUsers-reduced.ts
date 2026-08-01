import type {
	result,
} from './getUser-reduced.ts';
import {
	ids_in_cache,
	cached as single_record,
	sub_query,
} from './getUser-reduced.ts';

import Ajv from './helper/ajv.ts';

import {
	cached as bulk_record_cached,
	live as bulk_record_live,
} from './helper/bulk-record.ts';

import schema from '../../schema/getUser-reduced.schema.json' with {
	type: 'json',
};

const {
	getUser,
	...schema_properties
} = schema.properties.data.properties;

export const validator = Ajv.compile<{
	data: {
		getUsers: result[],
	},
}>({
	...schema,
	properties: {
		...schema.properties,
		data: {
			...schema.properties.data,
			required: ['getUsers'],
			properties: {
				schema_properties,
				getUsers: {
					type: 'array',
					items: getUser,
				},
			},
		},
	},
});

export async function* live<
	Id extends result['id'],
>(
	ids: Iterable<Id>|AsyncIterable<Id>,
): AsyncGenerator<result> {
	yield* bulk_record_live<result>(
		'getUsers',
		undefined,
		sub_query,
		ids,
		validator,
		'userIds',
	);
}

export async function* cached<
	Id extends result['id'],
>(
	ids: Iterable<Id>|AsyncIterable<Id>,
) {
	yield* bulk_record_cached<result>(
		'getUsers',
		undefined,
		sub_query,
		ids,
		ids_in_cache(),
		single_record,
		validator,
		undefined,
		'getUser-reduced',
	);
}
