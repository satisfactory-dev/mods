import {
	existsSync,
} from 'node:fs';

import {
	readFile,
	writeFile,
} from 'node:fs/promises';

import Ajv from './helper/ajv.ts';

import get from './helper/single-record.ts';

import schema from '../../schema/getMods.schema.json' with {
	type: 'json',
};

import type image_url from './helper/image-url.ts';

import {
	stringify,
} from '../helper/json.ts';

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
	role: string,
};

type IdObject = {
	id: Exclude<string, ''>,
};

type HasLogo<
	Id extends Exclude<string, ''> = Exclude<string, ''>,
> = {
	logo: image_url<'mods', 'logo', Id>,
	logo_thumbhash: Exclude<string, ''>,
};

type HasLogoBorked<
	Id extends Exclude<string, ''> = Exclude<string, ''>,
> = {
	logo: HasLogo<Id>['logo'],
	logo_thumbhash: '',
};

type NoHasLogo = {
	logo: '',
	logo_thumbhash: '',
};

type CompatibilityInfo = {
	EA: Compatibility,
	EXP: Compatibility,
	Controller: ControllerCompatibility,
};

type AiUseDisclosureInfo = {
	message: string,
	disclosure_type: (
		| 'no_ai_usage'
		| 'ai_usage'
		| 'runtime_ai_usage'
	),
};

export type result<
	Id extends Exclude<string, ''> = Exclude<string, ''>,
	DateTimeType extends string | Date = string,
> = (
	& (
		| HasLogo<Id>
		| HasLogoBorked<Id>
		| NoHasLogo
	)
	& {
		id: Id,
		name: Exclude<string, ''>,
		short_description: string,
		full_description: string,
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
		compatibility: (
			| CompatibilityInfo
			| null
		),
		network_use_disclosure: (
			| string
			| null
		),
		ai_use_disclosure: (
			| AiUseDisclosureInfo
			| null
		),
		toggle_explicit_content: boolean,
		authors: [Author, ...Author[]],
		versions: IdObject[],
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
	}
);

export const validator = Ajv.compile<{
	data: {
		getMods: {
			mods: result[],
		},
	},
}>(schema);

const getMods = schema.properties.data.properties.getMods;

const Mod = schema.$defs.Mod;

export const freshness_validator = Ajv.compile<{
	data: {
		getMods: {
			mods: {
				id: result['id'],
				updated_at: result['updated_at'],
			}[],
		},
	},
}>({
	...schema,
	properties: {
		...schema.properties,
		data: {
			...schema.properties.data,
			properties: {
				...schema.properties.data.properties,
				getMods: {
					...getMods,
					properties: {
						...getMods.properties,
						mods: {
							...getMods.properties.mods,
							items: {
								type: 'object',
								required: ['id', 'updated_at'],
								additionalProperties: false,
								properties: {
									id: Mod.properties.id,
									updated_at: Mod.properties.updated_at,
								},
							},
						},
					},
				},
			},
		},
	},
});

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

export const sub_query = `id
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
			role
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
}`;

export async function live<
	Id extends result['id'],
>(id: Id): Promise<result<Id>> {
	const result = await get<result>(
		'getMods',
		'mods',
		sub_query,
		id,
		validator,
	);

	verify_id(id, result);

	return result;
}

export async function cached<
	Id extends result['id'],
>(id: Id): Promise<result<Id>> {
	if (!/^[A-Za-z0-9]+$/.test(id)) {
		throw new Error(`Id for mod does not match expected pattern: ${id}`);
	}

	const cache_file = `${
		import.meta.dirname
	}/../../.cache/api/getMods/${id}.json`;

	if (!existsSync(cache_file)) {
		const result = await live(id);

		await writeFile(cache_file, stringify(result));

		return result;
	}

	const result: unknown = JSON.parse((
		await readFile(cache_file)).toString(),
	);

	const shim = {data: {
		getMods: {
			mods: [result],
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
