import type {
	result,
} from '../api/getMod--reduced.ts';
import {
	validator,
} from '../api/getMod--reduced.ts';

import type Provider from './interface.ts';

export default class Fetch implements Provider {
	#api_cache_root: `${string}/api/`;

	constructor(
		api_cache_root: `${string}/api/`,
	) {
		this.#api_cache_root = api_cache_root;
	}

	async getMod(id: result['id']): Promise<result> {
		return fetch(`${
			this.#api_cache_root
		}/getMod--reduced/${
			id
		}.json`)
			.then((e) => e.json())
			.then((maybe) => {
				if (!validator(maybe)) {
					console.error(validator.errors);

					throw new Error(`JSON response for mod ${
						id
					} failed to pass validation!`);
				}

				return maybe.data.getMod;
			});
	}
}
