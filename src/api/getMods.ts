import {
	basename,
} from 'node:path';

import {
	glob,
} from 'node:fs/promises';

import paginated from './helper/paginated.ts';

import schema from '../../schema/getMods.schema.json' with {
	type: 'json',
};

import type {
	result,
} from './getMod.ts';

type return_type = AsyncGenerator<result['id']>;

export async function* live(): return_type {
	const {
		properties: {
			data: {
				properties: {
					getMods: {
						properties: {
							mods: {
								items: _,
								...remaining
							},
							...remaining_properties_2
						},
						...remaining_getMods_0
					},
					...remaining_properties_1
				},
				...remaining_data_0
			},
			...remaining_properties_0
		},
		...fudged_schema
	} = schema;

	const id = schema.$defs.Mod.properties.id;

	const shrunk = {
		...fudged_schema,
		properties: {
			...remaining_properties_0,
			data: {
				...remaining_data_0,
				properties: {
					...remaining_properties_1,
					getMods: {
						...remaining_getMods_0,
						properties: {
							...remaining_properties_2,
							mods: {
								...remaining,
								items: {
									type: 'object',
									required: ['id'],
									additionalProperties: false,
									properties: {
										id,
									},
								},
							},
						},
					},
				},
			},
		},
	};

	for await (const mod of paginated<{
		id: result['id'],
	}>(
		'getMods',
		'mods',
		'id',
		shrunk,
	)) {
		if (!/^[A-Za-z0-9]+$/.test(mod.id)) {
			throw new Error(`Id for mod does not match expected pattern: ${
				mod.id
			}`);
		}

		yield mod.id;
	}
}

export async function* cached(): return_type {
	for await (const path of glob(`${
		import.meta.dirname
	}/../../.cache/api/getMods/*.json`)) {
		yield basename(path, '.json');
	}
}
