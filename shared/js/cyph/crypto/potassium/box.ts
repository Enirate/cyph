import {sodium} from 'libsodium';
import {mceliece} from 'mceliece';
import {ntru} from 'ntru';
import {IKeyPair} from '../ikey-pair';
import {IBox} from './ibox';
import * as NativeCrypto from './native-crypto';
import {OneTimeAuth} from './one-time-auth';
import {potassiumUtil} from './potassium-util';
import {SecretBox} from './secret-box';


/** @inheritDoc */
export class Box implements IBox {
	/** @ignore */
	private readonly helpers: {
		keyPair: () => Promise<IKeyPair>;
		nonceBytes: number;
		open: (
			cyphertext: Uint8Array,
			nonce: Uint8Array,
			keyPair: IKeyPair
		) => Promise<Uint8Array>;
		privateKeyBytes: number;
		publicKeyBytes: number;
		seal: (
			plaintext: Uint8Array,
			nonce: Uint8Array,
			publicKey: Uint8Array
		) => Promise<Uint8Array>;
	}	= {
		keyPair: async () : Promise<IKeyPair> =>
			this.isNative ?
				NativeCrypto.box.keyPair() :
				sodium.crypto_box_keypair()
		,

		nonceBytes:
			this.isNative ?
				NativeCrypto.secretBox.nonceBytes :
				sodium.crypto_box_NONCEBYTES
		,

		open: async (
			cyphertext: Uint8Array,
			nonce: Uint8Array,
			keyPair: IKeyPair
		) : Promise<Uint8Array> =>
			this.isNative ?
				NativeCrypto.box.open(
					cyphertext,
					nonce,
					keyPair
				) :
				sodium.crypto_box_seal_open(
					cyphertext,
					keyPair.publicKey,
					keyPair.privateKey
				)
		,

		privateKeyBytes:
			this.isNative ?
				NativeCrypto.box.privateKeyBytes :
				sodium.crypto_box_SECRETKEYBYTES
		,

		publicKeyBytes:
			this.isNative ?
				NativeCrypto.box.publicKeyBytes :
				sodium.crypto_box_PUBLICKEYBYTES
		,

		seal: async (
			plaintext: Uint8Array,
			nonce: Uint8Array,
			publicKey: Uint8Array
		) : Promise<Uint8Array> =>
			this.isNative ?
				NativeCrypto.box.seal(
					plaintext,
					nonce,
					publicKey
				) :
				sodium.crypto_box_seal(
					plaintext,
					publicKey
				)
	};

	/** @inheritDoc */
	public readonly privateKeyBytes: Promise<number>	= Promise.resolve(
		mceliece.privateKeyBytes +
		ntru.privateKeyBytes +
		this.helpers.privateKeyBytes
	);

	/** @inheritDoc */
	public readonly publicKeyBytes: Promise<number>		= Promise.resolve(
		mceliece.publicKeyBytes +
		ntru.publicKeyBytes +
		this.helpers.publicKeyBytes
	);

	/** @ignore */
	private async publicKeyDecrypt (
		keyCyphertext: Uint8Array,
		privateKey: Uint8Array,
		name: string,
		encryptedKeyBytes: number,
		decrypt: (cyphertext: Uint8Array, privateKey: Uint8Array) => Uint8Array
	) : Promise<{
		innerKeys: Uint8Array;
		symmetricKey: Uint8Array;
	}> {
		const oneTimeAuthBytes		= await this.oneTimeAuth.bytes;
		const oneTimeAuthKeyBytes	= await this.oneTimeAuth.keyBytes;
		const secretBoxKeyBytes		= await this.secretBox.keyBytes;

		const encryptedKeys: Uint8Array	= new Uint8Array(
			keyCyphertext.buffer,
			keyCyphertext.byteOffset,
			encryptedKeyBytes
		);

		const mac: Uint8Array			= new Uint8Array(
			keyCyphertext.buffer,
			keyCyphertext.byteOffset + encryptedKeyBytes,
			oneTimeAuthBytes
		);

		const innerKeys: Uint8Array		= decrypt(
			encryptedKeys,
			privateKey
		);

		const symmetricKey: Uint8Array	= new Uint8Array(
			innerKeys.buffer,
			0,
			secretBoxKeyBytes
		);

		const authKey: Uint8Array		= new Uint8Array(
			innerKeys.buffer,
			secretBoxKeyBytes,
			oneTimeAuthKeyBytes
		);

		const isValid: boolean			= await this.oneTimeAuth.verify(
			mac,
			encryptedKeys,
			authKey
		);

		if (!isValid) {
			potassiumUtil.clearMemory(innerKeys);
			throw new Error(`Invalid ${name} cyphertext.`);
		}

		return {innerKeys, symmetricKey};
	}

	/** @ignore */
	private async publicKeyEncrypt (
		publicKey: Uint8Array,
		name: string,
		plaintextBytes: number,
		encrypt: (plaintext: Uint8Array, publicKey: Uint8Array) => Uint8Array
	) : Promise<{
		innerKeys: Uint8Array;
		keyCyphertext: Uint8Array;
		symmetricKey: Uint8Array;
	}> {
		const oneTimeAuthKeyBytes	= await this.oneTimeAuth.keyBytes;
		const secretBoxKeyBytes		= await this.secretBox.keyBytes;

		if (plaintextBytes < (secretBoxKeyBytes + oneTimeAuthKeyBytes)) {
			throw new Error(`Not enough space for keys; must increase ${name} parameters.`);
		}

		const innerKeys: Uint8Array		= potassiumUtil.randomBytes(plaintextBytes);

		const symmetricKey: Uint8Array	= new Uint8Array(
			innerKeys.buffer,
			0,
			secretBoxKeyBytes
		);

		const authKey: Uint8Array		= new Uint8Array(
			innerKeys.buffer,
			secretBoxKeyBytes,
			oneTimeAuthKeyBytes
		);

		const encryptedKeys: Uint8Array	= encrypt(
			innerKeys,
			publicKey
		);

		const mac: Uint8Array			= await this.oneTimeAuth.sign(
			encryptedKeys,
			authKey
		);

		return {
			innerKeys,
			symmetricKey,
			keyCyphertext: potassiumUtil.concatMemory(
				true,
				encryptedKeys,
				mac
			)
		};
	}

	/** @ignore */
	private splitPrivateKey (privateKey: Uint8Array) : {
		classical: Uint8Array;
		mcEliece: Uint8Array;
		ntru: Uint8Array;
	} {
		return {
			classical: new Uint8Array(
				privateKey.buffer,
				privateKey.byteOffset,
				this.helpers.privateKeyBytes
			),
			mcEliece: new Uint8Array(
				privateKey.buffer,
				privateKey.byteOffset +
					this.helpers.privateKeyBytes
				,
				mceliece.privateKeyBytes
			),
			ntru: new Uint8Array(
				privateKey.buffer,
				privateKey.byteOffset +
					this.helpers.privateKeyBytes +
					mceliece.privateKeyBytes
				,
				ntru.privateKeyBytes
			)
		};
	}

	/** @ignore */
	private splitPublicKey (publicKey: Uint8Array) : {
		classical: Uint8Array;
		mcEliece: Uint8Array;
		ntru: Uint8Array;
	} {
		return {
			classical: new Uint8Array(
				publicKey.buffer,
				publicKey.byteOffset,
				this.helpers.publicKeyBytes
			),
			mcEliece: new Uint8Array(
				publicKey.buffer,
				publicKey.byteOffset +
					this.helpers.publicKeyBytes
				,
				mceliece.publicKeyBytes
			),
			ntru: new Uint8Array(
				publicKey.buffer,
				publicKey.byteOffset +
					this.helpers.publicKeyBytes +
					mceliece.publicKeyBytes
				,
				ntru.publicKeyBytes
			)
		};
	}

	/** @inheritDoc */
	public async keyPair () : Promise<IKeyPair> {
		const keyPairs	= {
			classical: await this.helpers.keyPair(),
			mcEliece: mceliece.keyPair(),
			ntru: ntru.keyPair()
		};

		return {
			keyType: 'potassium-box',
			privateKey: potassiumUtil.concatMemory(
				true,
				keyPairs.classical.privateKey,
				keyPairs.mcEliece.privateKey,
				keyPairs.ntru.privateKey
			),
			publicKey: potassiumUtil.concatMemory(
				true,
				keyPairs.classical.publicKey,
				keyPairs.mcEliece.publicKey,
				keyPairs.ntru.publicKey
			)
		};
	}

	/** @inheritDoc */
	public async open (cyphertext: Uint8Array, keyPair: IKeyPair) : Promise<Uint8Array> {
		const oneTimeAuthBytes		= await this.oneTimeAuth.bytes;

		const privateSubKeys	= this.splitPrivateKey(keyPair.privateKey);
		const publicSubKeys		= this.splitPublicKey(keyPair.publicKey);

		let cyphertextIndex	= cyphertext.byteOffset;

		const mcElieceData						= await this.publicKeyDecrypt(
			new Uint8Array(
				cyphertext.buffer,
				cyphertextIndex,
				mceliece.cyphertextBytes +
					oneTimeAuthBytes
			),
			privateSubKeys.mcEliece,
			'McEliece',
			mceliece.cyphertextBytes,
			(c: Uint8Array, sk: Uint8Array) => mceliece.decrypt(c, sk)
		);

		cyphertextIndex +=
			mceliece.cyphertextBytes +
			oneTimeAuthBytes
		;

		const ntruData							= await this.publicKeyDecrypt(
			new Uint8Array(
				cyphertext.buffer,
				cyphertextIndex,
				ntru.cyphertextBytes +
					oneTimeAuthBytes
			),
			privateSubKeys.ntru,
			'NTRU',
			ntru.cyphertextBytes,
			(c: Uint8Array, sk: Uint8Array) => ntru.decrypt(c, sk)
		);

		cyphertextIndex +=
			ntru.cyphertextBytes +
			oneTimeAuthBytes
		;

		const nonce: Uint8Array					= new Uint8Array(
			cyphertext.buffer,
			cyphertextIndex,
			this.helpers.nonceBytes
		);

		cyphertextIndex += this.helpers.nonceBytes;

		const mcElieceCyphertext: Uint8Array	= new Uint8Array(
			cyphertext.buffer,
			cyphertextIndex,
			cyphertext.byteLength -
				(cyphertextIndex - cyphertext.byteOffset)
		);
		const ntruCyphertext: Uint8Array		= await this.secretBox.open(
			mcElieceCyphertext,
			mcElieceData.symmetricKey
		);
		const classicalCyphertext: Uint8Array	= await this.secretBox.open(
			ntruCyphertext,
			ntruData.symmetricKey
		);

		const plaintext: Uint8Array	= await this.helpers.open(
			classicalCyphertext,
			nonce,
			{
				privateKey: privateSubKeys.classical,
				publicKey: publicSubKeys.classical
			}
		);

		potassiumUtil.clearMemory(mcElieceData.innerKeys);
		potassiumUtil.clearMemory(ntruData.innerKeys);
		potassiumUtil.clearMemory(ntruCyphertext);
		potassiumUtil.clearMemory(classicalCyphertext);

		return plaintext;
	}

	/** @inheritDoc */
	public async seal (plaintext: Uint8Array, publicKey: Uint8Array) : Promise<Uint8Array> {
		const publicSubKeys	= this.splitPublicKey(publicKey);

		const mcElieceData						= await this.publicKeyEncrypt(
			publicSubKeys.mcEliece,
			'McEliece',
			mceliece.plaintextBytes,
			(p: Uint8Array, pk: Uint8Array) => mceliece.encrypt(p, pk)
		);

		const ntruData							= await this.publicKeyEncrypt(
			publicSubKeys.ntru,
			'NTRU',
			ntru.plaintextBytes,
			(p: Uint8Array, pk: Uint8Array) => ntru.encrypt(p, pk)
		);

		const nonce: Uint8Array					= await this.secretBox.newNonce(
			this.helpers.nonceBytes
		);

		const classicalCyphertext: Uint8Array	= await this.helpers.seal(
			plaintext,
			nonce,
			publicSubKeys.classical
		);
		const ntruCyphertext: Uint8Array		= await this.secretBox.seal(
			classicalCyphertext,
			ntruData.symmetricKey
		);
		const mcElieceCyphertext: Uint8Array	= await this.secretBox.seal(
			ntruCyphertext,
			mcElieceData.symmetricKey
		);

		potassiumUtil.clearMemory(ntruData.innerKeys);
		potassiumUtil.clearMemory(mcElieceData.innerKeys);

		return potassiumUtil.concatMemory(
			true,
			mcElieceData.keyCyphertext,
			ntruData.keyCyphertext,
			nonce,
			mcElieceCyphertext
		);
	}

	constructor (
		/** @ignore */
		private readonly isNative: boolean,

		/** @ignore */
		private readonly oneTimeAuth: OneTimeAuth,

		/** @ignore */
		private readonly secretBox: SecretBox
	) {}
}
