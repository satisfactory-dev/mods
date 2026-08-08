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

export async function lunr(): Promise<[string, ...string[]]> {
	const indices: Promise<string>[] = [];

	for await (const path of glob(`${
		import.meta.dirname
	}/../../dist/lunr.*.json`)) {
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
	}/../../dist/tags.*.json`)) {
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

export const toggles_providers: TogglesProviders = {
	woso: (async () => {
		for await (const path of glob(`${
			import.meta.dirname
		}/../../dist/mod-ids/stable.mod-ids.*.json`)) {
			return import(path, {
				with: {
					type: 'json',
				},
			}).then(({default: ids}) => new Set(ids as string[]));
		}

		throw new Error('Could not find file!');
	})(),
	controller: (async () => {
		for await (const path of glob(`${
			import.meta.dirname
		}/../../dist/mod-ids/controller-supported-or-moot.mod-ids.*.json`)) {
			return import(path, {
				with: {
					type: 'json',
				},
			}).then(({default: ids}) => new Set(ids as string[]));
		}

		throw new Error('Could not find file!');
	})(),
	noai: (async () => {
		for await (const path of glob(`${
			import.meta.dirname
		}/../../dist/mod-ids/ai.mod-ids.*.json`)) {
			return import(path, {
				with: {
					type: 'json',
				},
			}).then(({default: ids}) => new Set(ids as string[]));
		}

		throw new Error('Could not find file!');
	})(),
};
