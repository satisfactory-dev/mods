import type {
	ValidateFunction,
} from '../../helper/ajv.ts';

export default <T>(
	validator: ValidateFunction<T>,
	result: unknown,
): T => {
	if (!validator(result)) {
		console.error(validator.errors);

		throw new Error('Failed to validate response!');
	}

	return result;
};
