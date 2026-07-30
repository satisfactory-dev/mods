export type {
	SchemaObject,
	ValidateFunction,
} from 'ajv/dist/2019.js';
import Ajv from 'ajv/dist/2019.js';

import $defs from '../../../schema/$defs.schema.json' with {type: 'json'};

const instance = new Ajv({
	strict: true,
	verbose: true,
});

instance.addSchema($defs);

export default instance;
