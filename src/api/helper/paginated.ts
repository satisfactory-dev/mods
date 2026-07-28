import type {
	SchemaObject,
} from 'ajv';

import upstream from './run.ts';
import Ajv from 'ajv';

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
	})`, `${iterate_on} {${sub_query}} count`);
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

	const validator = (new Ajv({
		strict: true,
		verbose: true,
	})).compile<T>(schema);

	let limit = 32;
	let offset = 0;

	let yielded = 0;

	let result = await run(operation, iterate_on, sub_query, limit, offset);

	if (!validator(result)) {
		console.error(validator.errors);

		throw new Error('Failed to validate response!');
	}

	yield* result.data[operation][iterate_on];

	yielded += result.data[operation][iterate_on].length;

	while (result.data[operation].count > yielded) {
		offset += limit;

		result = await run(operation, iterate_on, sub_query, limit, offset);

		if (!validator(result)) {
			console.error(validator.errors);

			throw new Error('Failed to validate response!');
		}

		yield* result.data[operation][iterate_on];

		yielded += result.data[operation][iterate_on].length;
	}
}
