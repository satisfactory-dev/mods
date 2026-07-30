import {
	from_single_record_as_set,
	cached as getMods,
} from './src/api/getMods.ts';

import {
	cached as getMod,
} from './src/api/getMod.ts';

import {
	cached as getUser,
} from './src/api/getUser-reduced.ts';

let pass = new Set<Exclude<string, ''>>(await from_single_record_as_set());

for await (const id of getMods()) {
	pass.add(id);
}

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

	for (const id of pass) {
		++mods;

		console.log(`Checking mod ${
			mods
		} of ${
			pass.size
		} in current pass ${
			id
		}`);

		const mod = await getMod(id);

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

	const current_state = await from_single_record_as_set();

	pass = user_mod_ids.difference(current_state);
}
