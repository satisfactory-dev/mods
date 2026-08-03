import type {
	result as Mod,
} from '../api/getMod--reduced.ts';

export default interface Provider {
	getMod(id: Mod['id']): Promise<Mod>;
}
