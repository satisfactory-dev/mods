import type {
	Logoless,
	result,
} from '../getMod.ts';
import {
	cached as single_record_version,
} from '../getVersions.ts';

export default async function last_updated<
	Id extends result['id'],
>(mod: Logoless<Id>) {
	let updated_at: string | undefined = undefined;

	const versions = [];

	for (const version_id of [
		mod.latestVersions.alpha,
		mod.latestVersions.beta,
		mod.latestVersions.release,
	]) {
		if (version_id) {
			versions.push(version_id.id);
		}
	}

	const last_updated: string[] = [];

	for (const version_id of versions) {
		for await (const version of single_record_version([version_id])) {
				last_updated.push(version.created_at);
		}
	}

	last_updated.sort((a, b) => {
		return (new Date(b)).getTime() - (new Date(a)).getTime();
	});

	if (last_updated.length > 0) {
		updated_at = last_updated[0];
	}

	return updated_at;
}
