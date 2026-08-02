import type {
	ValidateFunction,
} from '../../helper/ajv.ts';

import upstream from './run.ts';

import validated from './validated.ts';

function run(
	operation: string,
	iterate_on: string,
	sub_query: string,
	id: string,
): Promise<unknown> {
	return upstream(`${operation}(filter: {
		ids: "${id}",
	})`, `${iterate_on} {${sub_query}}`);
}

export default async function record<
	ResultType,
	Operation extends string = string,
	IterateOn extends string = string,
>(
	operation: Operation,
	iterate_on: IterateOn,
	sub_query: string,
	id: string,
	validator: ValidateFunction<{
		data: {
			[k1 in Operation]: {
				[k2 in IterateOn]: ResultType[];
			}
		},
	}>,
) {
	const result = validated(validator, await run(
		operation,
		iterate_on,
		sub_query,
		id,
	));

	if (1 !== result.data[operation][iterate_on].length) {
		throw new Error(`Could not find record ${id}`);
	}

	return result.data[operation][iterate_on][0];
}
