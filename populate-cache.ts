import {
	cached as getMod_ids,
	live,
} from './src/api/getMods--ids-only.ts';

import {
	cached as getMods,
} from './src/api/getMods.ts';

import {
	cached as getUser,
} from './src/api/getUser-reduced.ts';

import {
	async_generator_to_set,
} from './src/helper/async_generator_to_set.ts';

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

while (pass.size > 0) {
	++passes;

	console.log(`Running pass ${passes} against ${pass.size} mods`);

	const user_ids = new Set<Exclude<string, ''>>();

	const user_mod_ids = new Set<Exclude<string, ''>>();

	let mods = 0;

	for await (const mod of getMods(pass)) {
		++mods;

		console.log(`Checking mod ${
			mods
		} of ${
			pass.size
		} in current pass ${
			mod.id
		}`);

		user_ids.add(mod.creator_id);

		for (const {user_id} of mod.authors) {
			user_ids.add(user_id);
		}
	}

	let user_check = 0;

	for (const id of user_ids) {
		++user_check;

		if (known_missing_users.has(id)) {
			continue;
		}

		console.log(`checking ${
			user_check
		} of ${
			user_ids.size
		} users found in current pass: ${
			id
		}`);

		const user = await getUser(id);

		for (const {mod_id} of user.mods) {
			user_mod_ids.add(mod_id);
		}
	}

	const current_state = await async_generator_to_set(getMod_ids());

	pass = user_mod_ids.difference(current_state);
}
