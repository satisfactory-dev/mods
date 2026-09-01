import type {
	result,
} from './getMod.ts';
import {
	freshness_validator,
	sub_query,
	validator,
} from './getMod.ts';

import {
	cached as ids_in_cache,
} from './getMods--ids-only.ts';

import {
	cached as single_record,
} from './getMod.ts';

import {
	cached as bulk_record_cached,
	live as bulk_record_live,
} from './helper/bulk-record.ts';

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
	yield_error = false,
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
		'getMods',
		'ids',
		yield_error,
	);
}
