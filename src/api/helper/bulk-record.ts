import type {
	ValidateFunction,
} from './ajv.ts';

import upstream from './run.ts';

import validated from './validated.ts';

function run(
	operation: string,
	iterate_on: string,
	sub_query: string,
	ids: [string, ...string[]],
): Promise<unknown> {
	return upstream(`${operation}(filter: {
		ids: ${JSON.stringify(ids)},
	})`, `${iterate_on} {${sub_query}}`);
}

export function is_non_empty<T>(list: T[]): list is [T, ...T[]] {
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

export default async function* records<
	ResultType extends {id: Exclude<string, ''>},
	Operation extends string = string,
	IterateOn extends string = string,
>(
	operation: Operation,
	iterate_on: IterateOn,
	sub_query: string,
	ids: Iterable<Exclude<string, ''>>|AsyncIterable<Exclude<string, ''>>,
	validator: ValidateFunction<{
		data: {
			[k1 in Operation]: {
				[k2 in IterateOn]: ResultType[];
			}
		},
	}>,
) {
	for await (const chunk of chunk_ids(ids)) {
		const result = validated(validator, await run(
			operation,
			iterate_on,
			sub_query,
			chunk,
		));

		for (const id_in_request_order of chunk) {
			const result_in_request_order = result.data[
				operation
			][
				iterate_on
			].find(({id: maybe}) => maybe === id_in_request_order);

			if (!result_in_request_order) {
				throw new Error(`${
					id_in_request_order
				} not found in results!`);
			}

			yield result_in_request_order;
		}
	}
}
