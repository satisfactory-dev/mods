import type {} from '@signpostmarv/js-types';

import type {
	IndexResult,
	SerializedIndex,
} from '@satisfactory-dev/lunr';
import {
	Index,
} from '@satisfactory-dev/lunr';

import type {
	SchemaObject,
	ValidateFunction,
} from '../helper/ajv.ts';

export type Commands = {
	init: {
		cmd: 'init',
		args: [string],
	},
	search: {
		cmd: 'search',
		args: [string],
	},
};

export type CommandChoice<
	K extends keyof Commands = keyof Commands,
> = Commands[K];

export type Results = {
	init: {
		success: 'init',
	},
	search: {
		success: 'search',
		result: [
			string,
			IndexResult[],
		],
	},
};

export type CommandError = {
	error: keyof Commands,
	message: string,
};

export function compile_cmd_schema() {
const args: [SchemaObject, ...SchemaObject[]] = [
	[
		'init',
		[
			{type: 'string', minLength: 1},
		],
	],
	[
		'search',
		[
			{type: 'string', minLength: 1},
		],
	],
].map(([
	cmd,
	args,
]): SchemaObject => ({
	type: 'object',
	required: ['cmd', 'args'],
	additionalProperties: false,
	properties: {
		cmd: {
			type: 'string',
			const: cmd,
		},
		args: {
			type: 'array',
			minItems: args.length,
			maxItems: args.length,
			prefixItems: args,
		},
	},
}));

	return {
		$id: 'search-thread-cmd',
	oneOf: args,
	};
}

function get_cmd_validator() {
	return import(
		'../../.cache/search.validator.ts',
	).then(({
		validator_thread_cmd,
	}) => validator_thread_cmd as ValidateFunction<
		CommandChoice
	>);
}

let index: Index|undefined = undefined;

if ('self' in globalThis) {
	const self = globalThis.self;
self.addEventListener('message', (e) => {
	get_cmd_validator().then((validator) => {
	if (!validator(e.data)) {
		console.error('failure inside worker', validator.errors);

		postMessage(
			{error: 'unsupported command'},
		);

		return;
	}

	const {cmd, args} = e.data;

	if ('init' === cmd) {
		index = Index.load(JSON.parse(args[0]) as SerializedIndex);
		postMessage(
			{success: 'init'},
		);
	} else if ('search' === cmd) {
		if (undefined === index) {
			postMessage(
				{error: 'init', message: 'Index not initialised'},
			);
		} else {
			const result = index.search(args[0]);

			postMessage(
				{success: 'search', result: [args[0], result]},
			);
		}
	}
	});
});
}
