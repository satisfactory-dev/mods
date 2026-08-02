import type {
	SchemaObject,
} from '../../helper/ajv.ts';
import Ajv from '../../helper/ajv.ts';

import count from './count.ts';

import upstream from './run.ts';

import validated from './validated.ts';

function run(
	operation: string,
	iterate_on: string,
	sub_query: string,
	limit: number,
	offset: number,
): Promise<unknown> {
	return upstream(`${operation}(filter: {
		limit: ${limit},
		offset: ${offset},
	})`, `${iterate_on} {${sub_query}}`);
}

export default async function* paginated<
	ResultType,
	Operation extends string = string,
	IterateOn extends string = string,
>(
	operation: Operation,
	iterate_on: IterateOn,
	sub_query: string,
	schema: SchemaObject,
) {
	type T = {
		data: {
			[k1 in Operation]: (
				& {
					[k2 in IterateOn]: ResultType[];
				}
				& {
					count: number,
				}
			)
		},
	};

	const validator = Ajv.compile<T>(schema);

	let offset = 0;

	let yielded = 0;

	const total = await count(operation);

	const limit = Math.max(32, Math.min(100, total));

	async function get() {
		const result = await run(
			operation,
			iterate_on,
			sub_query,
			limit,
			offset,
		);

		return validated(validator, result);
	}

	let result = await get();

	yield* result.data[operation][iterate_on];

	yielded += result.data[operation][iterate_on].length;

	console.log(`fetching ${
		total
	} over ${
		Math.ceil(total / limit)
	} pages`);

	while (total > yielded) {
		offset += limit;

		result = await get();

		yield* result.data[operation][iterate_on];

		yielded += result.data[operation][iterate_on].length;
	}
}
