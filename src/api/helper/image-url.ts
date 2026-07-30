type image_url<
	category extends Exclude<string, ''>,
	filename extends Exclude<string, ''>,
	Id extends Exclude<string, ''> = Exclude<string, ''>,
> = `https://storage.ficsit.app/file/smr-prod${'-s3'|''}/images/${
		category
	}/${
		Id
	}/${
		filename
	}.webp`;

export default image_url;
