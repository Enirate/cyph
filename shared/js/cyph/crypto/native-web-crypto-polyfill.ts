/**
 * @file Web Crypto API polyfill for NativeScript.
 */


(() => {
	let getRandomByte: () => number;

	/* Android */
	if (
		(<any> self).java !== undefined &&
		(<any> self).java.security !== undefined &&
		(<any> self).java.security.SecureRandom !== undefined
	) {
		const secureRandom	= new java.security.SecureRandom();
		getRandomByte		= () => secureRandom.nextInt(256);
	}
	/* iOS */
	else if ((<any> self).arc4random_uniform !== undefined) {
		getRandomByte		= () => arc4random_uniform(256);
	}
	/* Other */
	else {
		throw new Error('Crypto polyfill not implemented for this platform.');
	}

	crypto	= {
		getRandomValues: (arrayBufferView: ArrayBufferView) => {
			const bytes	= new Uint8Array(arrayBufferView.buffer);

			for (let i = 0 ; i < bytes.length ; ++i) {
				bytes[i]	= getRandomByte();
			}

			return arrayBufferView;
		},

		subtle: <SubtleCrypto> {}
	};

	(<any> self).crypto	= crypto;
})();
