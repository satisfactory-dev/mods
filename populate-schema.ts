import {
	writeFile,
} from 'node:fs/promises';

import type {
	TypeScriptifyConfig,
} from '@satisfactory-dev/ajv-utilities';
import {
	typescriptify,
} from '@satisfactory-dev/ajv-utilities';

import type {
	AnyValidateFunction,
} from 'ajv/dist/core.js';

import standalone from 'ajv/dist/standalone/index.js';

import ts from '@typescript/typescript6';

import {
	compile_schema as compile_Mods_schema,
} from './src/api/getMods--reduced.ts';

import {
	compile_schema as compile_Mod_schema,
} from './src/api/getMod--reduced.ts';

import {
	fresh,
	HasLogo__NoThumbHash,
	NoHasLogo,
} from './src/helper/ajv.ts';

import tags_index_schema from './schema/tags-index.schema.json' with {
	type: 'json',
};

function wrap_stylistic(code: string) {
	return `${[
		'max-len',
		'max-statements-per-line',
	].map((e) => `// oxlint-disable @stylistic/${e}`).join('\n')}${
		'\n'
	}${code}`;
}

function wrap_eslint(code: string) {
	return `${[
		'no-unreachable',
		'no-unused-vars',
	].map((e) => `// oxlint-disable @eslint/${e}`).join('\n')}${
		'\n'
	}${code}`;
}

function wrap(code: string) {
	return wrap_eslint(wrap_stylistic(code));
}

const config: [
	`${string}/.cache/${string}.validator.ts`,
	(ajv: ReturnType<typeof fresh>) => void,
	Exclude<Parameters<typeof standalone>[1], AnyValidateFunction>,
	Partial<TypeScriptifyConfig>,
][] = [
	[
		`${import.meta.dirname}/.cache/json.validator.ts`,
		(ajv) => {
			ajv.addSchema(compile_Mods_schema());
			ajv.addSchema(compile_Mod_schema());
		},
		{
			validator_getMods_reduced: 'getMods--reduced',
			validator_getMod_reduced: 'getMod--reduced',
		},
		{
			remove_dataCtxKeys: [
				'parentData',
				'parentDataProperty',
			],
			specify_types: {
				'getMods--reduced': [
					{
						name: 'schema_type',
						as: 'getMods_reduced_schema_type',
					},
					'../src/api/getMods--reduced.ts',
				],
				'getMod--reduced': [
					{
						name: 'schema_type',
						as: 'getMod_reduced_schema_type',
					},
					'../src/api/getMod--reduced.ts',
				],
				[HasLogo__NoThumbHash.$id]: [
					'HasLogoNoThumbHash',
					'../src/api/getMod.ts',
				],
				[NoHasLogo.$id]: [
					'NoHasLogo',
					'../src/api/getMod.ts',
				],
			},
			specify_types_by_inside_out_match: [
				[
					{
						name: 'Logoless',
						sub_type_chain: ['compatibility'],
					},
					'../src/api/getMod--reduced.ts',
					{
						instancePath_partial: '/compatibility',
						parentDataProperty: 'compatibility',
					},
					[
						{
							name: 'result',
							as: 'getMod_reduced',
						},
						'../src/api/getMod--reduced.ts',
					],
				],
			],
			specify_properties: [
				{
					type: 'Logoless',
					from: '../src/api/getMod--reduced.ts',
					properties: [
						'id',
						'name',
						'short_description',
						'views',
						'downloads',
						'mod_reference',
						'hidden',
						'tags',
						'compatibility',
						'network_use_disclosure',
						'ai_use_disclosure',
					],
				},
				{
					type: 'Logo',
					from: '../src/api/getMod--reduced.ts',
					properties: ['logo'],
				},
				{
					type: 'CompatibilityInfo',
					from: '../src/api/getMod.ts',
					properties: ['EA', 'EXP', 'Controller'],
				},
			],
		},
	],
	[
		`${import.meta.dirname}/.cache/search.validator.ts`,
		(ajv) => {
			ajv.addSchema(tags_index_schema);
		},
		{
			validator_tag_index: 'tags-index',
		},
		{
			specify_types: {
				'tags-index': [
					'TagIndex',
					'../src/search.ts',
				],
			},
		},
	],
];

for (const [
	file_path,
	add_schema,
	standalone_config,
	typescriptify_config,
] of config) {
	const ajv = fresh({
		code: {
			esm: true,
			source: true,
			optimize: 2,
		},
	});

	add_schema(ajv);

	await writeFile(
		file_path,
		wrap(typescriptify(
			standalone(ajv, standalone_config),
			ts,
			typescriptify_config,
		)),
	);
}
