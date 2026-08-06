export type {
	SchemaObject,
	ValidateFunction,
} from 'ajv/dist/2020.js';

import type {
	Options,
} from 'ajv/dist/2020.js';
import Ajv from 'ajv/dist/2020.js';

import $defs from '../../schema/$defs.schema.json' with {type: 'json'};

// oxlint-disable-next-line @stylistic/max-len
import HasLogo__NoThumbHash from '../../schema/getMods.HasLogo.NoThumbHash.schema.json' with {
	type: 'json',
};

// oxlint-disable-next-line @stylistic/max-len
import NoHasLogo__NoThumbHash from '../../schema/getMods.NoHasLogo.NoThumbHash.schema.json' with {
	type: 'json',
};

// oxlint-disable-next-line @stylistic/max-len
import HasLogo from '../../schema/getMods.HasLogo.schema.json' with {
	type: 'json',
};

// oxlint-disable-next-line @stylistic/max-len
import HasLogoBorked from '../../schema/getMods.HasLogoBorked.schema.json' with {
	type: 'json',
};

// oxlint-disable-next-line @stylistic/max-len
import NoHasLogo from '../../schema/getMods.NoHasLogo.schema.json' with {
	type: 'json',
};

export function fresh(options?: Partial<Options>) {
const instance = new Ajv({
		...options,
	strict: true,
	verbose: true,
});

instance.addSchema($defs);
	instance.addSchema(HasLogo__NoThumbHash);
	instance.addSchema(NoHasLogo__NoThumbHash);
	instance.addSchema(HasLogo);
	instance.addSchema(HasLogoBorked);
	instance.addSchema(NoHasLogo);

	return instance;
}

const instance = fresh();

export default instance;

export {
	HasLogo__NoThumbHash,
	NoHasLogo__NoThumbHash,
	HasLogo,
	HasLogoBorked,
	NoHasLogo,
};
