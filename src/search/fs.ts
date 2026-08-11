import {
	glob,
	readFile,
} from 'node:fs/promises';

import {
	assert_non_empty,
} from '../helper/array.ts';

import type {
	TagIndex,
	TogglesProviders,
} from '../search.ts';
import {
	get_tags_index_validator,
} from '../search.ts';

import type {
	mod_ids_prefix,
} from '../../populate-index.ts';

export async function lunr(): Promise<[string, ...string[]]> {
	const indices: Promise<string>[] = [];

	for await (const path of glob(`${
		import.meta.dirname
	}/../../dist/data/lunr/lunr.*.json`)) {
		indices.push(
			readFile(path)
				.then((e) => e.toString()),
		);
	}

	assert_non_empty(indices);

	return Promise.all(indices);
}

export async function tags(): Promise<TagIndex[]> {
	const indices: Promise<TagIndex>[] = [];

	const tags_index_validator = await get_tags_index_validator();

	for await (const path of glob(`${
		import.meta.dirname
	}/../../dist/data/tags/tags.*.json`)) {
		indices.push(import(
			path,
			{
				with: {
					type: 'json',
				},
			},
		).then(({default: maybe}) => {
			if (!tags_index_validator(maybe)) {
				throw new Error(`Invalid tag index at ${path}`);
			}

			return maybe;
		}));
	}

	return Promise.all(indices);
}

async function mod_ids(
	prefix: mod_ids_prefix,
): Promise<Set<string>> {
		for await (const path of glob(`${
			import.meta.dirname
	}/../../dist/mod-ids/${prefix}.mod-ids.*.json`)) {
			return import(path, {
				with: {
					type: 'json',
				},
			}).then(({default: ids}) => new Set(ids as string[]));
		}

		throw new Error('Could not find file!');
}

export const toggles_providers: TogglesProviders = {
	compatibility: {
		unknown: mod_ids('compat-unknown'),
		EA: {
			Works: mod_ids('compat-EA-Works'),
			Broken: mod_ids('compat-EA-Broken'),
			Damaged: mod_ids('compat-EA-Damaged'),
		},
		EXP: {
			Works: mod_ids('compat-EXP-Works'),
			Broken: mod_ids('compat-EXP-Broken'),
			Damaged: mod_ids('compat-EXP-Damaged'),
		},
		Controller: {
			Untested: mod_ids(
				'compat-Controller-Untested',
			),
			Unsupported: mod_ids(
				'compat-Controller-Unsupported',
			),
			Partial: mod_ids(
				'compat-Controller-Partial',
			),
			Implicit: mod_ids(
				'compat-Controller-Implicit',
			),
			Supported: mod_ids(
				'compat-Controller-Supported',
			),
		},
	},
	has_source_linked: mod_ids('has-source-linked'),
	has_ai: mod_ids('has-ai'),
};
