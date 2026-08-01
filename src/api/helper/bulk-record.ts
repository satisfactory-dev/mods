import {
	stat,
	utimes,
	writeFile,
} from 'node:fs/promises';

import {
	async_generator_to_set,
} from '../../helper/async_generator_to_set.ts';

import type {
	ValidateFunction,
} from './ajv.ts';

import upstream from './run.ts';

import validated from './validated.ts';

import {
	stringify,
} from '../../helper/json.ts';

function run(
	operation: string,
	iterate_on: string|undefined,
	sub_query: string,
	ids: [string, ...string[]],
): Promise<unknown> {
	if (ids.length > 100) {
		throw new Error('Too many records requested!');
	}

	return upstream(`${operation}(filter: {
		limit: 100,
		ids: ${JSON.stringify(ids)},
	})`, (
		iterate_on
			? `${iterate_on} {${sub_query}}`
			: sub_query
	));
}

function is_non_empty<T>(list: T[]): list is [T, ...T[]] {
	return list.length > 0;
}

async function* chunk_ids<
	Id extends Exclude<string, ''>,
>(
	ids: Iterable<Id>|AsyncIterable<Id>,
): AsyncGenerator<[Id, ...Id[]]> {
	let current_page: Id[] = [];

	for await (const id of ids) {
		if (is_non_empty(current_page) && 100 === current_page.length) {
			yield current_page;

			current_page = [];
		}

		current_page.push(id);
	}

	if (is_non_empty(current_page)) {
		yield current_page;
	}
}

type Response<
	ResultType extends {id: Exclude<string, ''>},
	Operation extends string = string,
	IterateOn extends string|undefined = string,
> = IterateOn extends string
	? {
		data: {
			[k1 in Operation]: {
				[k2 in IterateOn]: ResultType[]
			}
		},
	}
	: {
		data: {
			[k1 in Operation]: ResultType[]
		},
	};

type Validator<
	ResultType extends {id: Exclude<string, ''>},
	Operation extends string = string,
	IterateOn extends string|undefined = string,
> = ValidateFunction<Response<
	ResultType,
	Operation,
	IterateOn
>>;

export async function* live<
	ResultType extends {id: Exclude<string, ''>},
	Operation extends string = string,
	IterateOn extends string|undefined = string|undefined,
>(
	operation: Operation,
	iterate_on: IterateOn,
	sub_query: string,
	ids: Iterable<Exclude<string, ''>>|AsyncIterable<Exclude<string, ''>>,
	validator: Validator<ResultType, Operation, IterateOn>,
) {
	for await (const chunk of chunk_ids(ids)) {
		const result = validated(validator, await run(
			operation,
			iterate_on,
			sub_query,
			chunk,
		));

		const data: ResultType[] = iterate_on
			? (result as Response<
				ResultType,
				Operation,
				Exclude<IterateOn, undefined>
			>).data[operation][iterate_on]
			: (result as Response<
				ResultType,
				Operation,
				undefined
			>).data[operation];

		for (const id_in_request_order of chunk) {
			const result_in_request_order = data.find((
				{id: maybe},
			) => maybe === id_in_request_order);

			if (!result_in_request_order) {
				throw new Error(`${
					id_in_request_order
				} not found in results!`);
			}

			yield result_in_request_order;
		}
	}
}

export async function* cached<
	ResultType extends {id: Exclude<string, ''>},
	Id extends ResultType['id'] = ResultType['id'],
	Operation extends string = string,
	IterateOn extends string|undefined = string|undefined,
>(
	operation: Operation,
	iterate_on: IterateOn,
	sub_query: string,
	ids: Iterable<Id>|AsyncIterable<Id>,
	get_current_state: AsyncGenerator<Id>,
	single_record: (id: Id) => Promise<ResultType>,
	validator: Validator<ResultType, Operation, IterateOn>,
	auto_refresh: (
		| undefined
		| Validator<{id: ResultType['id'], updated_at: string}>
	) = undefined,
	cache_dir = operation,
) {
	const current_state = await async_generator_to_set(get_current_state);

	if (auto_refresh) {
		const possibly_stale = (
			new Set(await Array.fromAsync(ids))
		).intersection(current_state);

		console.log(`checking ${possibly_stale.size} for possible staleness`);

		const update_cache = new Set<ResultType['id']>();

		const now = Date.now();

		for await (const maybe of live<{
			id: ResultType['id'],
			updated_at: string,
		}>(
			operation,
			iterate_on,
			'id updated_at',
			possibly_stale,
			auto_refresh,
		)) {
			const cache_file = `${
				import.meta.dirname
			}/../../../.cache/api/${
				cache_dir
			}/${
				maybe.id
			}.json`;

			if (
				(
					now - Math.max(
						(await stat(cache_file)).mtimeMs,
						(new Date(maybe.updated_at)).getTime(),
					)
				) > 86400_000
			) {
				update_cache.add(maybe.id);
			} else {
				await utimes(cache_file, now, now);
			}
		}

		for await (const fresh of live<ResultType>(
			operation,
			iterate_on,
			sub_query,
			update_cache,
			validator,
		)) {
			const cache_file = `${
				import.meta.dirname
			}/../../../.cache/api/${
				cache_dir
			}/${fresh.id}.json`;

			await writeFile(
				cache_file,
				stringify(fresh),
			);
		}

		console.log(`updated cache for ${
			update_cache.size
		} records`);
	}

	let current_defer_page: Id[] = [];

	async function* maybe_yield_and_cache() {
		if (is_non_empty(current_defer_page)) {
			for await (const result of live<
				ResultType,
				Operation,
				IterateOn
			>(
				operation,
				iterate_on,
				sub_query,
				current_defer_page,
				validator,
			)) {
				if (!/^[A-Za-z0-9]+$/.test(result.id)) {
					throw new Error(
						`Id for record does not match expected pattern: ${
							result.id
						}`,
					);
				}

				const cache_file = `${
					import.meta.dirname
				}/../../../.cache/api/${cache_dir}/${result.id}.json`;

				await writeFile(cache_file, stringify(result));

				yield result;
			}

			current_defer_page = [];
		}
	}

	for await (const id of ids) {
		if (current_state.has(id)) {
			yield* maybe_yield_and_cache();

			yield single_record(id);
		} else {
			current_defer_page.push(id);
		}
	}

	yield* maybe_yield_and_cache();
}
