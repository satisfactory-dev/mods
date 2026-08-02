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
} from '../helper/ajv.ts';
import Ajv from '../helper/ajv.ts';

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

const validator = Ajv.compile<Commands[keyof Commands]>({
	oneOf: args,
});

let index: Index|undefined = undefined;

self.addEventListener('message', (e) => {
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
