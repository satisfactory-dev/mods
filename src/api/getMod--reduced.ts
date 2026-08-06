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

// oxlint-disable-next-line @stylistic/max-len
import LogoSchema from '../../schema/getMods.HasLogo.NoThumbHash.schema.json' with {
	type: 'json',
};

import type {
	result as _result,
	HasLogo,
	NoHasLogo,
} from './getMod.ts';

import {
	stringify,
} from '../helper/json.ts';

const import_fields = [
	'id',
	'name',
	'short_description',
	'views',
	'downloads',
	'mod_reference',
	'hidden',
	'compatibility',
	'ai_use_disclosure',
	'tags',
	'network_use_disclosure',
] as const;

export type Logo<
	Id extends _result['id'] = _result['id'],
> = (
	| HasLogo<Id>
	| NoHasLogo
);

export type Logoless<
	Id extends _result['id'] = _result['id'],
	DateTimeType extends string | Date = string,
> = Pick<_result<Id, DateTimeType>, (typeof import_fields)[number]>;

export type result<
	Id extends _result['id'] = _result['id'],
	DateTimeType extends string | Date = string,
> = (
	& Logo<Id>
	& Pick<_result<Id, DateTimeType>, (typeof import_fields)[number]>
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
					$ref: 'HasLogo--NoThumbHash',
				},
				{
					$ref: 'NoHasLogo--NoThumbHash',
				},
			],
		},
		Mod: {
			type: 'object',
			required: [
				...imported_Mod_props.map(([prop]) => prop),
				'logo',
			],
			properties: {
				...Object.fromEntries(
					imported_Mod_props,
				),
				logo: {
					oneOf: [
						{
							...LogoSchema.properties.logo,
						},
						{
							type: 'string',
							const: '',
						},
					],
				},
			},
		},
	},
	properties: {
		..._schema.properties,
		data: {
			..._schema.properties.data,
			required: ['getMod'],
			properties: {
				getMod: {
					$ref: '#/$defs/Mod',
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
