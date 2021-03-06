import {IMessage} from './imessage';


/**
 * Encapsulates an end-to-end encrypted communication session.
 * This is the entire non-UI representation of a cyph.
 */
export interface ISession {
	/** State of the cyph (referenced by UI). */
	readonly state: {
		cyphId: string;
		isAlice: boolean;
		isAlive: boolean;
		sharedSecret: string;
		startingNewCyph?: boolean;
		wasInitiatedByAPI: boolean;
	};

	/**
	 * This kills the cyph.
	 */
	close () : void;

	/**
	 * Remove event listener.
	 * @param event
	 * @param handler
	 */
	off<T> (event: string, handler: (data: T) => void) : void;

	/**
	 * Add event listener.
	 * @param event
	 * @param handler
	 */
	on<T> (event: string, handler: (data: T) => void) : void;

	/**
	 * Returns first occurrence of event.
	 * @param event
	 */
	one<T> (event: string) : Promise<T>;

	/**
	 * Send at least one message through the session.
	 * @param messages
	 */
	send (...messages: IMessage[]) : void;

	/**
	 * Trigger event, passing in optional data.
	 * @param event
	 * @param data
	 */
	trigger (event: string, data?: any) : void;
}
