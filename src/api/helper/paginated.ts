import upstream from './run.ts';

function run(operation: string, iterate_on: string, sub_query: string, limit: number, offset: number) {
	return upstream(`${operation}(filter: {
		limit: ${limit},
		offset: ${offset},
	})`, `${iterate_on} {${sub_query}} count`);
}

export default async function* (operation: string, iterate_on: string, sub_query: string) {
	let limit = 32;
	let offset = 0;

	let yielded = 0;

	let result = await run(operation, iterate_on, sub_query, limit, offset);

	yield* result.data[operation][iterate_on];

	yielded += result.data[operation][iterate_on].length;

	while (result.data.getMods.count > yielded) {
		offset += limit;

		result = await run(operation, iterate_on, sub_query, limit, offset);

		yield* result.data[operation][iterate_on];

		yielded += result.data[operation][iterate_on].length;
	}
}
