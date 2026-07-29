import {
	existsSync,
} from 'node:fs';

import {
	readFile,
	writeFile,
} from 'node:fs/promises';

import Ajv from 'ajv';

import get from './helper/single-record.ts';

import schema from '../../schema/getMods.schema.json' with {
	type: 'json',
};

type Compatibility = {
	state: (
		| 'Works'
		| 'Damaged'
		| 'Broken'
	),
	note: string,
};

type ControllerCompatibility = {
	state: (
		| 'Untested'
		| 'Unsupported'
		| 'Partial'
		| 'Implicit'
		| 'Supported'
	),
	note: string,
};

type Author = {
	user_id: Exclude<string, ''>,
};

type IdObject = {
	id: Exclude<string, ''>,
};

export type result<
	Id extends Exclude<string, ''> = Exclude<string, ''>,
	DateTimeType extends string | Date = string,
> = {
	id: Id,
	name: Exclude<string, ''>,
	short_description: string,
	full_description: string,
	logo: `https://storage.ficsit.app/file/smr-prod-s3/images/mods/${
		Id
	}/logo.webp`,
	logo_thumbhash: Exclude<string, ''>,
	source_url: (
		| ''
		| `https://${string}`
	),
	creator_id: Exclude<string, ''>,
	approved: boolean,
	views: number,
	downloads: number,
	hotness: number,
	popularity: number,
	updated_at: DateTimeType,
	created_at: DateTimeType,
	last_version_date: DateTimeType,
	mod_reference: Exclude<string, ''>,
	hidden: boolean,
	tags: {
		id: Exclude<string, ''>,
	}[],
	compatibility: {
		EA: Compatibility,
		EXP: Compatibility,
		Controller: ControllerCompatibility,
	},
	network_use_disclosure: string,
	ai_use_disclosure: {
		message: string,
		disclosure_type: (
			| 'no_ai_usage'
			| 'ai_usage'
			| 'runtime_ai_usage'
		),
	},
	toggle_explicit_content: boolean,
	authors: [Author, ...Author[]],
	versions: [IdObject, ...IdObject[]],
	latestVersions: {
		alpha: (
			| null
			| IdObject
		),
		beta: (
			| null
			| IdObject
		),
		release: (
			| null
			| IdObject
		),
	},
};

const validator = (new Ajv({
	strict: true,
	verbose: true,
})).compile<{
	data: {
		getMods: {
			mods: result[],
		},
	},
}>(schema);

function verify_id<
	Id extends result['id'],
>(
	id: Id,
	possibly: result,
): asserts possibly is result<Id> {
	if (possibly.id !== id) {
		throw new Error('Mod id mismatch!');
	}
}

export async function live<
	Id extends result['id'],
>(id: Id): Promise<result<Id>> {
	const result = await get<result>(
		'getMods',
		'mods',
		`id
		name
		short_description
		full_description
		logo
		logo_thumbhash
		source_url
		creator_id
		approved
		views
		downloads
		hotness
		popularity
		updated_at
		created_at
		last_version_date
		mod_reference
		hidden
		tags{
			id
		}
		compatibility{
			EA{
				state
				note
			}
			EXP{
				state
				note
			}
			Controller{
				state
				note
		}
		}
		network_use_disclosure
		ai_use_disclosure{
			message
			disclosure_type
		}
		toggle_explicit_content
		authors{
			user_id
		}
		versions{
			id
		}
		latestVersions {
			alpha{
				id
			}
			beta{
				id
			}
			release {
				id
			}
		}`,
		id,
		validator,
	);

	verify_id(id, result);

	return result;
}

export async function cached<
	Id extends result['id'],
>(id: Id): Promise<result<Id>> {
	const cache_file = `${
		import.meta.dirname
	}/../../.cache/api/getMods/records/${id}.json`;

	if (!existsSync(cache_file)) {
		const result = await live(id);

		await writeFile(cache_file, JSON.stringify(result));

		return result;
	}

	const result: unknown = JSON.parse((
		await readFile(cache_file)).toString(),
	);

	const shim = {data: {
		getMods: {
			mods: [result],
			count: 1,
		},
	}};

	if (!validator(shim)) {
		console.error(validator.errors);

		throw new Error(`Cached record invalid for ${id}`);
	}

	verify_id(id, shim.data.getMods.mods[0]);

	return shim.data.getMods.mods[0];
}

export async function wrapped<
	Id extends result['id'],
>(
	id: Id,
	from: (
		| typeof live
		| typeof cached
	) = cached,
): Promise<result<Id, Date>> {
	const {
		updated_at,
		created_at,
		last_version_date,
		...result
	} = await from(id);

	return {
		...result,
		updated_at: new Date(updated_at),
		created_at: new Date(created_at),
		last_version_date: new Date(last_version_date),
	};
}
