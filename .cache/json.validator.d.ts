import type { StandaloneDataValidationCxt } from '@satisfactory-dev/ajv-utilities';
import type { schema_type as getMods_reduced_schema_type } from '../src/api/getMods--reduced.ts';
import type { schema_type as getMod_reduced_schema_type } from '../src/api/getMod--reduced.ts';
export declare const validator_getMods_reduced: typeof validate20;
declare function validate20(data: unknown, { instancePath, rootData, dynamicAnchors }?: Partial<StandaloneDataValidationCxt>): data is getMods_reduced_schema_type;
export declare const validator_getMod_reduced: typeof validate26;
declare function validate26(data: unknown, { instancePath, rootData, dynamicAnchors }?: Partial<StandaloneDataValidationCxt>): data is getMod_reduced_schema_type;
export {};
