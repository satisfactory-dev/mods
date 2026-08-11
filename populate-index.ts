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

import type {
	Compatibility,
	ControllerCompatibility,
} from './src/api/getMod.ts';
import {
	cached as single_record,
} from './src/api/getMod.ts';

import {
	stringify,
} from './src/helper/json.ts';

export type mod_ids_prefix = (
	| 'compat-unknown'
	| `compat-${'EA'|'EXP'}-${Compatibility['state']}`
	| `compat-Controller-${ControllerCompatibility['state']}`
	| 'has-source-linked'
	| 'has-ai'
);

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

const has_ai: index_by_year = new Map();

type index_by_year = Map<`${number}`, Set<doc['id']>>;

const compat_unknown: index_by_year = new Map();

const has_source_linked: index_by_year = new Map();

const compat_ea = new Map<Compatibility['state'], index_by_year>([
	['Works', new Map()],
	['Damaged', new Map()],
	['Broken', new Map()],
]);
const compat_exp = new Map<Compatibility['state'], index_by_year>([
	['Works', new Map()],
	['Damaged', new Map()],
	['Broken', new Map()],
]);
const compat_controller = new Map<
	ControllerCompatibility['state'],
	index_by_year
>([
	['Untested', new Map()],
	['Unsupported', new Map()],
	['Partial', new Map()],
	['Implicit', new Map()],
	['Supported', new Map()],
]);

function index_for_year(
	index: index_by_year,
	index_key: `${number}`,
): Set<doc['id']> {
	const maybe = index.get(index_key);

	if (maybe) {
		return maybe;
	}

	const fresh = new Set<doc['id']>();

	index.set(index_key, fresh);

	return fresh;
}

function index_for_state<
	Type extends (
		| Compatibility
		| ControllerCompatibility
	),
	State extends Type['state'],
>(
	index: Map<Type['state'], index_by_year>,
	state: State,
	index_key: `${number}`,
): Set<doc['id']> {
	let maybe = index.get(state);

	if (!maybe) {
		maybe = new Map();

		index.set(state, maybe);
	}

	return index_for_year(maybe, index_key);
}

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
	] = created_at.split('T')[0].split('-') as [
		`${number}`,
	];

	const index_key: `${number}` = year;

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
		index_for_year(has_ai, index_key).add(mod.id);
	}

	if (mod.source_url) {
		index_for_year(has_source_linked, index_key).add(mod.id);
	}

	if (null === mod.compatibility) {
		index_for_year(compat_unknown, index_key).add(mod.id);
	} else {
		index_for_state(
			compat_ea,
			mod.compatibility.EA.state,
			index_key,
		).add(mod.id);
		index_for_state(
			compat_exp,
			mod.compatibility.EA.state,
			index_key,
		).add(mod.id);
		index_for_state(
			compat_controller,
			mod.compatibility.Controller.state,
			index_key,
		).add(mod.id);
	}
}

await writeFile(
	`${import.meta.dirname}/.cache/indexed-mod-ids.json`,
	stringify([...mod_ids]),
);

const mod_id_indices: [
	`${string}.mod-ids` | `${string}.${number}.mod-ids`,
	Set<doc['id']>,
][] = [];

for (
	const [
		prefix,
		mod_id_sets,
	] of [
		[
			'has-ai',
			has_ai,
		],
		[
			'compat-unknown',
			compat_unknown,
		],
		[
			'has-source-linked',
			has_source_linked,
		],
	] as const
) {
	for (const [index_key, mod_ids] of mod_id_sets) {
		mod_id_indices.push([
			`${prefix}.${index_key}.mod-ids`,
			mod_ids,
		]);
	}
}

for (const [type, mod_id_sets] of [
	[
		'EA',
		compat_ea,
	],
	[
		'EXP',
		compat_exp,
	],
	[
		'Controller',
		compat_controller,
	],
] as const) {
	for (const [compat_state, mod_ids_by_state] of mod_id_sets) {
		for (const [index_key, mod_ids] of mod_ids_by_state) {
			mod_id_indices.push([
				`compat-${
					type
				}-${
					compat_state
				}.${
					index_key
				}.mod-ids`,
				mod_ids,
			]);
		}
	}
}

for (
	const [
		basename,
		data,
	] of mod_id_indices
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
