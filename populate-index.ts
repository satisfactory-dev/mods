import {
	hash,
} from 'node:crypto';

import {
	existsSync,
} from 'node:fs';

import {
	glob,
	unlink,
	writeFile,
} from 'node:fs/promises';

import type {
	Index,
} from '@satisfactory-dev/lunr';
import lunr from '@satisfactory-dev/lunr';

import {
	convert,
} from 'html-to-text';

import MarkdownIt from 'markdown-it';

import {
	cached as ids_in_cache,
} from './src/api/getMods--ids-only.ts';

import {
	cached as getMods,
} from './src/api/getMods.ts';

import type {
	result,
} from './src/api/getMod.ts';

const md = new MarkdownIt();

type doc = {
	id: result['id'],
	mod_reference: result['mod_reference'],
	short_description: result['mod_reference'],
	full_description: string,
};

const docs_by_index_key = new Map<string, Set<doc>>();

const mods_by_tag = new Map<string, Set<result['id']>>();

for await (const mod of getMods(ids_in_cache())) {
	if (mod.hidden) {
		continue;
	}

	const doc = {
		id: mod.id,
		mod_reference: mod.mod_reference,
		short_description: mod.short_description,
		full_description: convert(md.render(mod.full_description), {
			decodeEntities: true,
		}),
	};

	const [
		year,
	] = mod.created_at.split('T')[0].split('-');

	const index_key = year;

	let add_to = docs_by_index_key.get(index_key);
	if (!add_to) {
		add_to = new Set<doc>();

		docs_by_index_key.set(index_key, add_to);
	}

	add_to.add(doc);

	for (const {id: tag_id} of mod.tags) {
		let tags_set = mods_by_tag.get(tag_id);

		if (!tags_set) {
			tags_set = new Set();

			mods_by_tag.set(tag_id, tags_set);
		}

		tags_set.add(mod.id);
	}
}

const indices = new Map<string, Index>();

for (const [index_key, docs] of docs_by_index_key) {
	indices.set(index_key, lunr((builder) => {
		builder.field('name', {
			boost: 10,
		});
		builder.field('mod_reference', {
			boost: 2,
		});
		builder.field('short_description');
		builder.field('full_description');

		builder.metadataWhitelist = [];

		for (const doc of docs) {
			builder.add(doc);
		}
	}));
}

const cache_files = new Set<string>();

for (const [index_key, index] of indices) {
	const index_string = JSON.stringify(index);
	const sha512 = hash('sha-512', index_string, 'hex');

	const cache_file = `${
		import.meta.dirname
	}/dist/lunr.${
		index_key
	}.${
		sha512.substring(0, 8)
	}.json`;

	if(!existsSync(cache_file)) {
		await writeFile(cache_file, index_string);
	}

	cache_files.add(cache_file);
}

const tag_files = new Set<string>();

for (const [tag_id, mods] of mods_by_tag) {
	const index_string = JSON.stringify({
		tag_id,
		mods: [...mods.values()],
	});
	const sha512 = hash('sha-512', index_string, 'hex');

	const cache_file = `${
		import.meta.dirname
	}/dist/tags.${
		tag_id
	}.${
		sha512.substring(0, 8)
	}.json`;

	if(!existsSync(cache_file)) {
		await writeFile(cache_file, index_string);
	}

	tag_files.add(cache_file);
}

for (const [prefix, check] of [
	['lunr', cache_files],
	['tags', tag_files],
] as const) {
	for await (const match of glob(`${
		import.meta.dirname
	}/dist/${
		prefix
	}.*.json`)) {
		if (!check.has(match)) {
			await unlink(match);
		}
	}
}
