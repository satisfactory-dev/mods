import {
	basename,
} from 'node:path';

import {
	glob,
	readFile,
} from 'node:fs/promises';

import Ajv from './helper/ajv.ts';

import run from './helper/run.ts';

import schema from '../../schema/getSatisfactoryVersions.schema.json' with {
	type: 'json',
};
import validated from './helper/validated.ts';

export type result<
	Id extends Exclude<string, ''> = Exclude<string, ''>,
> = {
	id: Id,
	version: number,
	engine_version: Exclude<string, ''>,
};

export const validator = Ajv.compile<{
	data: {
		getSatisfactoryVersions: result[],
	},
}>(schema);

export async function* ids_in_cache(): AsyncGenerator<result['id']> {
	for await (const path of glob(`${
		import.meta.dirname
	}/../../.cache/api/getSatisfactoryVersions/*.json`)) {
		yield basename(path, '.json');
	}
}

const sub_query = `id
	version
	engine_version`;

export async function* live(): AsyncGenerator<result> {
	const result = validated(
		validator,
		await run('getSatisfactoryVersions', sub_query),
	);

	yield* result.data.getSatisfactoryVersions;
}

export async function* cached() {
	for await (const maybe of glob(`${
		import.meta.dirname
	}/../../.cache/api/getSatisfactoryVersions/*.json`)) {
		const result: unknown = JSON.parse((await readFile(maybe)).toString());

		const shim = {data: {
			getSatisfactoryVersions: [result],
		}};

		if (!validator(shim)) {
			console.error(validator.errors);

			throw new Error(`Cached record invalid for ${maybe}`);
		}

		yield shim.data.getSatisfactoryVersions[0];
	}
}
