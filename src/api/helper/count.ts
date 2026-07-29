import Ajv from './ajv.ts';

import upstream from './run.ts';
import validated from './validated.ts';

function run(
	operation: string,
): Promise<unknown> {
	return upstream(operation, `count`);
}

export default async function count<
	Operation extends string = string,
>(
	operation: Operation,
) {
	const validator = Ajv.compile<{
		data: {
			[k in Operation]: {
				count: number,
			};
		},
	}>({
		type: 'object',
		required: ['data'],
		additionalProperties: false,
		properties: {
			data: {
				type: 'object',
				required: [operation],
				additionalProperties: false,
				properties: {
					[operation]: {
						type: 'object',
						required: ['count'],
						properties: {
							count: {
								type: 'integer',
								minimum: 0,
							},
						},
					},
				},
			},
		},
	});

	const result = validated(validator, await run(
		operation,
	));

	return result.data[operation].count;
}
