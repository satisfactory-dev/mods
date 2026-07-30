import {
	writeFile,
} from 'node:fs/promises';

import type {
	result,
} from './getMod.ts';
import {
	sub_query,
	validator,
} from './getMod.ts';

import {
	cached as ids_in_cache,
} from './getMods--ids-only.ts';

import {
	cached as single_record,
} from './getMod.ts';

import bulk_record, {
	is_non_empty,
} from './helper/bulk-record.ts';

import {
	stringify,
} from '../helper/json.ts';

import {
	async_generator_to_set,
} from '../helper/async_generator_to_set.ts';

export async function* live<
	Id extends result['id'],
>(
	ids: Iterable<Id>|AsyncIterable<Id>,
): AsyncGenerator<result> {
	yield* bulk_record<result>(
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
	const current_state = await async_generator_to_set(ids_in_cache());

	let current_defer_page: Id[] = [];

	async function* maybe_yield_and_cache() {
		if (is_non_empty(current_defer_page)) {
			for await (const result of live(current_defer_page)) {
				const cache_file = `${
					import.meta.dirname
				}/../../.cache/api/getMods/${result.id}.json`;

				await writeFile(cache_file, stringify(result));

				yield result;
			}

			current_defer_page = [];
		}
	}

	for await (const id of ids) {
		if (!/^[A-Za-z0-9]+$/.test(id)) {
			throw new Error(`Id for mod does not match expected pattern: ${
				id
			}`);
		}

		if (current_state.has(id)) {
			yield* maybe_yield_and_cache();

			yield single_record(id);
		} else {
			current_defer_page.push(id);
		}
	}

	yield* maybe_yield_and_cache();
}
