import {util} from '../../util';
import {IPotassium} from '../potassium/ipotassium';
import {Core} from './core';
import {ILocalUser} from './ilocal-user';
import {IRemoteUser} from './iremote-user';
import {Transport} from './transport';


/**
 * Represents a pairwise (one-to-one) Castle session.
 */
export class PairwiseSession {
	/** @ignore */
	private readonly core: Promise<Core>	=
		/* tslint:disable-next-line:promise-must-complete */
		new Promise<Core>(resolve => {
			this.resolveCore	= resolve;
		})
	;

	/** @ignore */
	private incomingMessageId: number	= 0;

	/** @ignore */
	private readonly incomingMessages: Map<number, Uint8Array[]>	=
		new Map<number, Uint8Array[]>()
	;

	/** @ignore */
	private incomingMessagesMax: number	= 0;

	/** @ignore */
	private isAborted: boolean;

	/** @ignore */
	private isConnected: boolean;

	/** @ignore */
	private localUser?: ILocalUser;

	/** @ignore */
	private readonly locks				= {
		receive: {},
		send: {}
	};

	/** @ignore */
	private outgoingMessageId: number	= 0;

	/** @ignore */
	private remoteUser?: IRemoteUser;

	/** @ignore */
	private remoteUsername: string;

	/** @ignore */
	private resolveCore: (core: Core) => void;

	/** @ignore */
	private abort () : void {
		if (this.isAborted) {
			return;
		}

		this.isAborted	= true;
		this.transport.abort();
	}

	/** @ignore */
	private connect () : void {
		if (this.isConnected) {
			return;
		}

		this.isConnected	= true;
		this.transport.connect();
	}

	/** @ignore */
	private async handshakeOpenSecret (cyphertext: Uint8Array) : Promise<Uint8Array> {
		if (!this.localUser) {
			throw new Error('Local user not found.');
		}

		const keyPair	= await this.localUser.getKeyPair();

		const secret	= await this.potassium.box.open(
			cyphertext,
			keyPair
		);

		this.potassium.clearMemory(keyPair.privateKey);
		this.potassium.clearMemory(keyPair.publicKey);

		this.localUser	= undefined;

		return secret;
	}

	/** @ignore */
	private async handshakeSendSecret (secret: Uint8Array) : Promise<Uint8Array> {
		if (!this.remoteUser) {
			throw new Error('Remote user not found.');
		}

		const remotePublicKey	= await this.remoteUser.getPublicKey();

		const cyphertext		= await this.potassium.box.seal(
			secret,
			remotePublicKey
		);

		this.potassium.clearMemory(remotePublicKey);

		this.remoteUser	= undefined;

		return cyphertext;
	}

	/** @ignore */
	private newMessageId () : Uint8Array {
		return new Uint8Array(new Float64Array([
			this.outgoingMessageId++
		]).buffer);
	}

	/**
	 * Receive/decrypt incoming message.
	 * @param cyphertext
	 */
	public async receive (cyphertext: string) : Promise<void> {
		if (this.isAborted) {
			return;
		}

		try {
			const cyphertextBytes: Uint8Array	=
				this.potassium.fromBase64(cyphertext)
			;

			if (this.transport.cyphertextIntercepters.length > 0) {
				const cyphertextIntercepter	= this.transport.cyphertextIntercepters.shift();

				if (cyphertextIntercepter) {
					cyphertextIntercepter(cyphertextBytes);
					return;
				}
			}

			const id: number	= new Float64Array(cyphertextBytes.buffer, 0, 1)[0];

			if (id >= this.incomingMessageId) {
				this.incomingMessagesMax	= Math.max(
					this.incomingMessagesMax,
					id
				);

				util.getOrSetDefault(
					this.incomingMessages,
					id,
					() => []
				).push(
					cyphertextBytes
				);
			}
		}
		catch (_) {}

		return util.lock(this.locks.receive, async () => {
			while (this.incomingMessageId <= this.incomingMessagesMax) {
				const incomingMessages	= this.incomingMessages.get(this.incomingMessageId);

				if (incomingMessages === undefined) {
					break;
				}

				for (const cyphertextBytes of incomingMessages) {
					try {
						let plaintext: DataView	= await (await this.core).decrypt(
							cyphertextBytes
						);

						/* Part 2 of handshake for Alice */
						if (this.localUser) {
							const oldPlaintext	= this.potassium.toBytes(plaintext);

							plaintext	= new DataView((
								await this.handshakeOpenSecret(oldPlaintext)
							).buffer);

							this.potassium.clearMemory(oldPlaintext);
						}

						/* Completion of handshake */
						if (!this.remoteUser) {
							this.connect();
						}

						this.transport.receive(
							cyphertextBytes,
							plaintext,
							this.remoteUsername
						);

						this.incomingMessages.delete(this.incomingMessageId++);
						break;
					}
					catch (_) {
						if (!this.isConnected) {
							this.abort();
						}
					}
					finally {
						this.potassium.clearMemory(cyphertextBytes);
					}
				}
			}
		});
	}

	/**
	 * Send/encrypt outgoing message.
	 * @param plaintext
	 * @param timestamp
	 */
	public async send (plaintext: string, timestamp: number = util.timestamp()) : Promise<void> {
		if (this.isAborted) {
			return;
		}

		return util.lock(this.locks.send, async () => {
			const plaintextBytes: Uint8Array	= this.potassium.fromString(plaintext);
			const timestampBytes: Float64Array	= new Float64Array([timestamp]);

			let data: Uint8Array	= this.potassium.concatMemory(
				true,
				timestampBytes,
				plaintextBytes
			);

			/* Part 2 of handshake for Bob */
			if (this.remoteUser) {
				const oldData	= data;
				data			= await this.handshakeSendSecret(oldData);
				this.potassium.clearMemory(oldData);
			}

			const messageId		= this.newMessageId();
			const cyphertext	= await (await this.core).encrypt(data, messageId);

			this.potassium.clearMemory(data);
			this.transport.send(cyphertext, messageId);
		});
	}

	constructor (
		/** @ignore */
		private readonly potassium: IPotassium,

		/** @ignore */
		private readonly transport: Transport,

		localUser: ILocalUser,

		remoteUser: IRemoteUser,

		isAlice: boolean
	) { (async () => {
		try {
			this.localUser	= localUser;
			this.remoteUser	= remoteUser;

			this.remoteUsername	= await this.remoteUser.getUsername();

			await this.localUser.getKeyPair();

			let secret: Uint8Array;
			if (isAlice) {
				secret	= this.potassium.randomBytes(
					await potassium.ephemeralKeyExchange.secretBytes
				);

				this.transport.send(await this.handshakeSendSecret(secret));
			}
			else {
				secret	= await this.handshakeOpenSecret(
					await this.localUser.getRemoteSecret()
				);

				this.send('');
			}

			this.resolveCore(new Core(
				this.potassium,
				isAlice,
				[await Core.newKeys(this.potassium, isAlice, secret)]
			));
		}
		catch (_) {
			this.abort();
		}
	})(); }
}
