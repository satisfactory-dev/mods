import type {
	ValidateFunction,
} from 'ajv';

import type {
	result,
	schema_type,
} from '../api/getMod--reduced.ts';
import {
	get_validator,
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
		return Promise.all([
			get_validator(),
			fetch(
				`${this.#api_cache_root}/getMod--reduced/${id}.json`,
			).then((e) => e.json()),
		])
			.then(([
				validator,
				raw,
			]: [
				ValidateFunction<schema_type>,
				unknown,
			]) => {
				const maybe = {data: {getMod: raw}};

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
