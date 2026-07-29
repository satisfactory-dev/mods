export type {
	SchemaObject,
	ValidateFunction,
} from 'ajv/dist/2019.js';
import Ajv from 'ajv/dist/2019.js';

const instance = new Ajv({
	strict: true,
	verbose: true,
});

export default instance;
