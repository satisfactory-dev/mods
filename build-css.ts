import {
	glob,
	readFile,
	unlink,
	writeFile,
} from 'node:fs/promises';

import {
	basename,
} from 'node:path';

import {
	hash,
} from 'node:crypto';

import {
	existsSync,
} from 'node:fs';

import postcss from 'postcss';

import cssnano from 'cssnano';

for await (const path of glob(
	`${import.meta.dirname}/css/*.postcss`,
)) {
	const {css} = await postcss([
		cssnano({
			preset: [
				'default',
				{
					cssDeclarationSorter: {
						order: 'concentric-css',
					},
				},
			],
		}),
	]).process(await readFile(path), {
		from: path,
	});

	const sha512 = hash('sha-512', css, 'hex');

	const output_file = `${
		import.meta.dirname
	}/dist/css/${
		basename(path, '.postcss')
	}-${
		sha512.substring(0, 8)
	}.css`;

	if (!existsSync(output_file)) {
		await writeFile(output_file, css);
	}

	for await (const stale of glob(`${
		import.meta.dirname
	}/dist/css/${
		basename(path, '.postcss')
	}-*.css`)) {
		if (stale !== output_file) {
			await unlink(stale);
		}
	}
}
