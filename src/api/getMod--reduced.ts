import {
	existsSync,
} from 'node:fs';

import {
	readFile,
	writeFile,
} from 'node:fs/promises';

import Ajv from '../helper/ajv.ts';

import run from './helper/run.ts';

import validated from './helper/validated.ts';

import _schema from '../../schema/getMods.schema.json' with {
	type: 'json',
};

import type {
	result as _result,
} from './getMod.ts';

import {
	stringify,
} from '../helper/json.ts';

const import_fields = [
	'id',
	'name',
	'short_description',
	'logo',
	'views',
	'downloads',
	'mod_reference',
	'hidden',
	'compatibility',
	'ai_use_disclosure',
	'tags',
	'network_use_disclosure',
] as const;

export type result<
	Id extends _result['id'] = _result['id'],
> = (
	& Pick<_result<Id>, (typeof import_fields)[number]>
);

const imported_Mod_props = Object.entries(_schema.$defs.Mod.properties)
	.filter(([
		maybe,
	]) => (
		import_fields as unknown as string[]
	).includes(
		maybe,
	));

export const schema = {
	..._schema,
	$defs: {
		..._schema.$defs,
		'possibly-has-logo': {
			oneOf: [
				{
					$ref: '#/$defs/HasLogo',
				},
				{
					$ref: '#/$defs/NoHasLogo',
				},
			],
		},
		HasLogo: {
			..._schema.$defs.HasLogo,
			required: ['logo'],
		},
		NoHasLogo: {
			..._schema.$defs.NoHasLogo,
			required: ['logo'],
		},
		Mod: {
			type: 'object',
			required: imported_Mod_props.map(([prop]) => prop),
			properties: Object.fromEntries(
				imported_Mod_props,
			),
		},
	},
	properties: {
		..._schema.properties,
		data: {
			..._schema.properties.data,
			required: ['getMod'],
			properties: {
				getMod: {
					allOf: [
						{
							$ref: '#/$defs/Mod',
						},
						{
							$ref: '#/$defs/possibly-has-logo',
						},
					],
				},
			},
		},
	},
};

export const validator = Ajv.compile<{
	data: {
		getMod: result,
	},
}>(schema);

function verify_id<
	Id extends result['id'],
>(
	id: Id,
	result: result,
): asserts result is result<Id> {
	if (result.id !== id) {
		throw new Error(`Expected ${id}, got ${result.id}`);
	}
}

export const sub_query = `
	id
	name
	short_description
	logo
	views
	downloads
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
	}`;

export async function live<
	Id extends result['id'],
>(id: Id): Promise<result<Id>> {
	const result = validated(validator, await run(
		`getMod(modId: ${
			JSON.stringify(id)
		})`,
		sub_query,
	)).data.getMod;

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
	}/../.cache/api/getMod--reduced/${id}.json`;

	if (!existsSync(cache_file)) {
		const result = await live(id);

		await writeFile(cache_file, stringify(result));

		return result;
	}

	const getMod: unknown = JSON.parse((
		await readFile(cache_file)).toString(),
	);

	const shim = {data: {getMod}};

	if (!validator(shim)) {
		console.error(validator.errors);

		throw new Error(`Cached record invalid for ${id}`);
	}

	verify_id(id, shim.data.getMod);

	return shim.data.getMod;
}
