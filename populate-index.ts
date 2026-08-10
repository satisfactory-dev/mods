import {
	hash,
} from 'node:crypto';

import {
	existsSync,
} from 'node:fs';

import {
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

import type {
	result,
} from './src/api/getMod--reduced.ts';

import {
	cached as getMods,
} from './src/api/getMods.ts';

import {
	cached as single_record,
} from './src/api/getMod.ts';

import {
	stringify,
} from './src/helper/json.ts';

const md = new MarkdownIt();

type doc = {
	id: result['id'],
	mod_reference: result['mod_reference'],
	short_description: result['mod_reference'],
	full_description: string,
};

const docs_by_index_key = new Map<string, Set<doc>>();

const mods_by_tag = new Map<string, Set<result['id']>>();

const mod_ids = new Set<doc['id']>();

const has_ai = new Set<doc['id']>();

const stable_mods = new Set<doc['id']>();

const controller_supported_or_moot_mods = new Set<doc['id']>();

const broken_source = new Set<doc['id']>();

for await (const mod of getMods(ids_in_cache())) {
	if (mod.hidden) {
		continue;
	}

	const {
		created_at,
		full_description,
	} = await single_record(mod.id);

	const doc = {
		id: mod.id,
		mod_reference: mod.mod_reference,
		short_description: mod.short_description,
		full_description: convert(md.render(full_description), {
			decodeEntities: true,
		}),
	};

	mod_ids.add(doc.id);

	const [
		year,
	] = created_at.split('T')[0].split('-');

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

	if (
		null === mod.ai_use_disclosure
		|| 'ai_usage' === mod.ai_use_disclosure?.disclosure_type
		|| 'runtime_ai_usage' === mod.ai_use_disclosure?.disclosure_type
	) {
		has_ai.add(mod.id);
	}

	if ('Works' === mod.compatibility?.EA.state) {
		stable_mods.add(mod.id);
	}

	if (
		'Implicit' === mod.compatibility?.Controller.state
		|| 'Supported' === mod.compatibility?.Controller.state
	) {
		controller_supported_or_moot_mods.add(mod.id);
	}

	if (
		'' !== mod.source_url
		&& 'Works' !== mod.compatibility?.EA.state
		&& 'Works' !== mod.compatibility?.EXP.state
	) {
		broken_source.add(mod.id);
	}
}

await writeFile(
	`${import.meta.dirname}/.cache/indexed-mod-ids.json`,
	stringify([...mod_ids]),
);

for (
	const [
		basename,
		data,
	] of [
		[
			'ai.mod-ids',
			has_ai,
		],
		[
			'stable.mod-ids',
			stable_mods,
		],
		[
			'controller-supported-or-moot.mod-ids',
			controller_supported_or_moot_mods,
		],
		[
			'broken-with-source-linked.mod-ids',
			broken_source,
		],
	] as const
) {
	const index_string = stringify([...data]);
	const sha512 = hash('sha-512', index_string, 'hex');

	const cache_file = `${
		import.meta.dirname
	}/.cache/data/mod-ids/${basename}.${
		sha512.substring(0, 8)
	}.json`;

	if(!existsSync(cache_file)) {
		await writeFile(cache_file, index_string);
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
	}/.cache/data/lunr/lunr.${
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
	}/.cache/data/tags/tags.${
		tag_id
	}.${
		sha512.substring(0, 8)
	}.json`;

	if(!existsSync(cache_file)) {
		await writeFile(cache_file, index_string);
	}

	tag_files.add(cache_file);
}
