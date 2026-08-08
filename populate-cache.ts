import {
	hash,
} from 'node:crypto';

import {
	glob,
	readFile,
	unlink,
	writeFile,
} from 'node:fs/promises';

import {
	existsSync,
} from 'node:fs';

import sharp from 'sharp';

import {
	cached as getMod_ids,
	live,
} from './src/api/getMods--ids-only.ts';

import {
	cached as getMods,
} from './src/api/getMods.ts';

import {
	live as getUsers,
} from './src/api/getUsers-reduced.ts';

import type {
	result as Tag,
} from './src/api/getTags.ts';
import {
	cached as getTags,
} from './src/api/getTags.ts';

import type {
	result as Version,
} from './src/api/getVersions.ts';
import {
	cached as getVersions,
} from './src/api/getVersions.ts';

import {
	live as getSatisfactoryVersions,
} from './src/api/getSatisfactoryVersions.ts';

import {
	async_generator_to_set,
} from './src/helper/async_generator_to_set.ts';

import {
	stringify,
} from './src/helper/json.ts';

import type {
	HasLogo,
	HasLogoBorked,
	result,
} from './src/api/getMod.ts';

const start = performance.now();

const logo_sizes_cache_file = `${
	import.meta.dirname
}/.cache/logo-sizes.json`;
const full_mod_api_hash_cache_file = `${
	import.meta.dirname
}/.cache/mod-api-hashes.json`;

const tag_ids_to_check = new Set<Tag['id']>();

export type logo_size = [
	number, // scale
	number, // width
	number, // height
	string, // hash substring
];

let logo_sizes: Map<
	result['id'],
	[
		logo_size,
		logo_size,
		logo_size,
	]
>;

if (existsSync(logo_sizes_cache_file)) {
	logo_sizes = new Map(await import(logo_sizes_cache_file, {
		with: {
			type: 'json',
		},
	}).then(({
		default: cache,
	}) => Object.entries(cache as {
		[k in result['id']]: [
			logo_size,
			logo_size,
			logo_size,
		];
	})));
} else {
	logo_sizes = new Map();
}

let full_mod_api_hash_cache: Map<result['id'], string>;

if (existsSync(full_mod_api_hash_cache_file)) {
	full_mod_api_hash_cache = new Map(await import(
		full_mod_api_hash_cache_file,
		{
			with: {
				type: 'json',
			},
		},
	).then(({
		default: cache,
	}) => Object.entries(cache as {
		[k in result['id']]: string;
	})));
} else {
	full_mod_api_hash_cache = new Map();
}

let pass = (
	await async_generator_to_set(live())
).union(
	await async_generator_to_set(getMod_ids()),
);

let passes = 0;

export const known_missing_users = new Proxy(
	new Set<Exclude<string, ''>>([
		'BNB382BUGVPFfV',
	]),
	{
		get(target, property) {
			if (
				'add' === property
				|| 'delete' === property
				|| 'clear' === property
			) {
				throw new Error('read-only set');
			}

			const proxied = target[property as keyof typeof target];

			return 'function' === typeof proxied
				? proxied.bind(target)
				: proxied;
		},
	},
);

function filtered_add<T>(
	maybe: T,
	to: Set<T>,
	except: Set<T>,
) {
	if (!except.has(maybe)) {
		to.add(maybe);
	}
}

function has_logo(
	maybe: result,
): maybe is (result & (HasLogo | HasLogoBorked)) {
	return '' !== maybe.logo;
}

function has_expected_sizes(maybe: logo_size[]): maybe is [
	logo_size,
	logo_size,
	logo_size,
] {
	return 3 === maybe.length;
}

async function logo(mod: result) {
	if (!has_logo(mod)) {
		return;
	}

	const mod_cache_file = `${
		import.meta.dirname
	}/.cache/api/getMods/${mod.id}.json`;

	if (!existsSync(mod_cache_file)) {
		throw new Error(`Cache file for mod ${mod.id} does not exist!`);
	}

	const current_mod_hash = hash(
		'sha512',
		await readFile(mod_cache_file),
		'hex',
	);

	const existing_logo_caches = new Set<string>();
	const keep = new Set<string>();

	let retain_keeps = false;

	for await (const path of glob(
		`${
			import.meta.dirname
		}/.cache/{logo,thumbnail}/${
			mod.id
		}{.,-*.}{webp,avif}`,
	)) {
		existing_logo_caches.add(path);
	}

	try {
		const logo_cache_file = `${
			import.meta.dirname
		}/.cache/logo/${mod.id}.webp`;

		existing_logo_caches.add(logo_cache_file);

		if (
			logo_sizes.has(mod.id)
			&& existsSync(logo_cache_file)
			&& full_mod_api_hash_cache.get(mod.id) === current_mod_hash
		) {
			return;
		}

		console.log(`regenerating thumbnails for ${mod.id}`);

		full_mod_api_hash_cache.set(mod.id, current_mod_hash);

		await writeFile(
			logo_cache_file,
			Buffer.from(
				await (
					await fetch(mod.logo)
				).arrayBuffer(),
			),
		);

		const image = sharp(logo_cache_file, {
			autoOrient: true,
			animated: true,
		});

		const sizes: logo_size[] = [];

		for (const size of [
			120,
			160,
			200,
		]) {
			const thumb = image.resize({
				width: size,
				height: size,
				fit: 'inside',
				withoutEnlargement: true,
			});

			const {data, info} = await thumb.webp({
				quality: 60,
				smartSubsample: true,
				smartDeblock: true,
				effort: 6,
			}).toBuffer({
				resolveWithObject: true,
			});

			const sha512 = hash('sha512', data, 'hex');

			const hash_substring = sha512.substring(0, 8);

			sizes.push([size, info.width, info.height, hash_substring]);

			const output_file = `${
				import.meta.dirname
			}/.cache/thumbnail/${mod.id}-${
				size
			}-${
				hash_substring
			}.webp`;

			await writeFile(output_file, data);

			keep.add(output_file);
		}


		if (!has_expected_sizes(sizes)) {
			throw new Error(`Sizes missing for ${mod.id}`);
		}

		logo_sizes.set(mod.id, sizes);
		keep.add(logo_cache_file);

		retain_keeps = true;
	} finally {
		for (const path of existing_logo_caches) {
			if (!retain_keeps || !keep.has(path)) {
				await unlink(path);
			}
		}

		if (!retain_keeps) {
			logo_sizes.delete(mod.id);
		} else {
			await writeFile(
				logo_sizes_cache_file,
				stringify(Object.fromEntries(logo_sizes)),
			);
		}
	}
}

while (pass.size > 0) {
	++passes;

	console.log(`Running pass ${passes} against ${pass.size} mods`);

	const user_ids = new Set<Exclude<string, ''>>();

	const discovered_mod_ids = new Set<Exclude<string, ''>>();

	const version_ids_to_check = new Set<Version['id']>();

	let mods = 0;

	for await (const mod of getMods(pass)) {
		++mods;

		console.log(`Checking mod ${
			mods
		} of ${
			pass.size
		} in pass ${
			passes
		} ${
			mod.id
		}`);

		filtered_add(mod.creator_id, user_ids, known_missing_users);

		for (const {user_id} of mod.authors) {
			filtered_add(user_id, user_ids, known_missing_users);
		}

		for (const {id: tag_id} of mod.tags) {
			tag_ids_to_check.add(tag_id);
		}

		for (const {id: version_id} of mod.versions) {
			version_ids_to_check.add(version_id);
		}

		for (const version_id of [
			mod.latestVersions.alpha,
			mod.latestVersions.beta,
			mod.latestVersions.release,
		]) {
			if (version_id) {
				version_ids_to_check.add(version_id.id);
			}
		}

		await logo(mod);
	}

	let user_check = 0;

	for await (const user of getUsers(user_ids)) {
		++user_check;

		console.log(`checking ${
			user_check
		} of ${
			user_ids.size
		} users found in pass ${
			passes
		}: ${
			user.id
		}`);

		if (!/^[A-Za-z0-9]+$/.test(user.id)) {
			throw new Error(`Invalid id on user record ${
				user.id
			}`);
		}

		await writeFile(
			`${
				import.meta.dirname
			}/.cache/api/getUser-reduced/${
				user.id
			}.json`,
			stringify(user),
		);

		for (const {mod_id} of user.mods) {
			discovered_mod_ids.add(mod_id);
		}
	}

	const current_state = await async_generator_to_set(getMod_ids());

	let version_check = 0;

	for await (const version of getVersions(version_ids_to_check)) {
		++version_check;

		console.log(`checking dependencies for version ${
			version_check
		} of ${
			version_ids_to_check.size
		} versions found in pass ${
			passes
		}`);

		for (const {mod} of version.dependencies) {
			if (!mod) {
				continue;
			}

			const {id: mod_id} = mod;

			discovered_mod_ids.add(mod_id);
		}
	}

	pass = discovered_mod_ids.difference(current_state);
}

const tags: {
	[key: string]: {
		name: string,
		description: string,
	},
} = {};

for await (const {id, name, description} of getTags(tag_ids_to_check)) {
	tags[id] = {
		name,
		description,
	};
}

await writeFile(
	`${import.meta.dirname}/.cache/api/tags.json`,
	stringify(tags),
);

for await (const version of getSatisfactoryVersions()) {
	if (!/^[A-Za-z0-9]+$/.test(version.id)) {
		throw new Error(`Invalid id on satisfactory version record ${
			version.id
		}`);
	}

	await writeFile(
		`${import.meta.dirname}/.cache/api/getSatisfactoryVersions/${
			version.id
		}`,
		stringify(version),
	);
}

await writeFile(
	logo_sizes_cache_file,
	stringify(Object.fromEntries(logo_sizes)),
);

await writeFile(
	full_mod_api_hash_cache_file,
	stringify(Object.fromEntries(full_mod_api_hash_cache)),
);

console.log(`finished after ${performance.now() - start}ms`);
