import {
	existsSync,
} from 'node:fs';

import {
	basename,
} from 'node:path';

import {
	glob,
	readFile,
} from 'node:fs/promises';

import Ajv from './helper/ajv.ts';

import {
	cached as bulk_record_cached,
	live as bulk_record_live,
} from './helper/bulk-record.ts';

import type {
	result as Mod,
} from './getMod.ts';

import schema from '../../schema/getVersions.schema.json' with {
	type: 'json',
};

export type result<
	Id extends Exclude<string, ''> = Exclude<string, ''>,
	DateTimeType extends string|Date = string,
> = {
	id: Id,
	mod_id: Mod['id'],
	version: Exclude<string, ''>,
	sml_version: Exclude<string, ''>,
	game_version: Exclude<string, ''>,
	required_on_remote: boolean,
	changelog: string,
	downloads: number,
	stability: (
		| 'alpha'
		| 'beta'
		| 'release'
	),
	approved: boolean,
	updated_at: DateTimeType,
	created_at: DateTimeType,
	link: Exclude<string, ''>,
	targets: {
		targetName: (
			| 'Windows'
			| 'WindowsServer'
			| 'LinuxServer'
		),
		link: Exclude<string, ''>,
		size: (
			| number
			| null
		),
		hash: (
			| string
			| null
		),
	}[],
	metadata: (
		| Exclude<string, ''>
		| null
	),
	size: (
		| number
		| null
	),
	hash: (
		| string
		| null
	),
	dependencies: {
		mod: (
			| {
				id: Mod['id'],
			}
			| null
		),
		condition: (
			| ''
			| '*'
			| 'N/A'
			| `${number}.${number}` // yes this technically resolves to a.b.c.d
			| `${number}.${number}.${number}`
			| `${number}.${number}.${number}-pr${number}`
			| `v${number}.${number}.${number}`
			| `^${number}`
			| `^${number}.${number}.${number}`
			| `^${number}.${number}.${number} <${number}.${number}.${number}`
			| `^${number}.${number}.${number}-pre.${number}`
			| `^${number}.${number}.${number}-dev`
			| `>${number}.${number}.${number}`
			| `>=${number}.${number}.${number}`
		),
		optional: boolean,
	}[],
	virustotal_results: {
		id: Exclude<string, ''>,
		hash: Exclude<string, ''>,
		safe: boolean,
		file_name: Exclude<string, ''>,
		created_at: DateTimeType,
		updated_at: DateTimeType,
	}[],
};

export const validator = Ajv.compile<{
	data: {
		getVersions: {
			versions: result[],
		},
	},
}>(schema);

export async function* ids_in_cache(): AsyncGenerator<result['id']> {
	for await (const path of glob(`${
		import.meta.dirname
	}/../../.cache/api/getVersions/*.json`)) {
		yield basename(path, '.json');
	}
}

const sub_query = `id
	mod_id
	version
	game_version
	required_on_remote
	changelog
	downloads
	stability
	approved
	updated_at
	created_at
	link
	targets {
		targetName
		link
		size
		hash
	}
	metadata
	size
	hash
	dependencies {
		mod {
			id
		}
		condition
		optional
	}
	virustotal_results {
		id
		hash
		safe
		file_name
		created_at
		updated_at
	}`;

export async function* live<
	Id extends result['id'],
>(
	ids: Iterable<Id>|AsyncIterable<Id>,
): AsyncGenerator<result> {
	yield* bulk_record_live<result>(
		'getVersions',
		'versions',
		sub_query,
		ids,
		validator,
	);
}

function verify_id<
	Id extends result['id'],
>(
	id: Id,
	possibly: result,
): asserts possibly is result<Id> {
	if (possibly.id !== id) {
		throw new Error('Tag id mismatch!');
	}
}

async function single_record<
	Id extends result['id'],
>(id: Id): Promise<result<Id>> {
	if (!/^[A-Za-z0-9]+$/.test(id)) {
		throw new Error(`Id for record does not match expected pattern: ${
			id
		}`);
	}

	const cache_file = `${
		import.meta.dirname
	}/../../.cache/api/getVersions/${id}.json`;

	if (!existsSync(cache_file)) {
		throw new Error(`Cannot fetch single record for non-cached item!`);
	}

	const result: unknown = JSON.parse((
		await readFile(cache_file)).toString(),
	);

	const shim = {data: {
		getVersions: {
			versions: [result],
		},
	}};

	if (!validator(shim)) {
		console.error(validator.errors);

		throw new Error(`Cached record invalid for ${id}`);
	}

	verify_id(id, shim.data.getVersions.versions[0]);

	return shim.data.getVersions.versions[0];
}

export async function* cached<
	Id extends result['id'],
>(
	ids: Iterable<Id>|AsyncIterable<Id>,
) {
	yield* bulk_record_cached<result>(
		'getVersions',
		'versions',
		sub_query,
		ids,
		ids_in_cache(),
		single_record,
		validator,
	);
}
