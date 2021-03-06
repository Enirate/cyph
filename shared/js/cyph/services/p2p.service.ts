import {Injectable} from '@angular/core';
import {IP2PHandlers} from '../p2p/ip2p-handlers';
import {users} from '../session/enums';
import {ChatService} from './chat.service';
import {DialogService} from './dialog.service';
import {P2PWebRTCService} from './p2p-webrtc.service';
import {SessionCapabilitiesService} from './session-capabilities.service';
import {SessionInitService} from './session-init.service';
import {StringsService} from './strings.service';


/**
 * Manages P2P sessions.
 */
@Injectable()
export class P2PService {
	/** @ignore */
	private readonly handlers: IP2PHandlers	= {
		acceptConfirm: async (callType: string, timeout: number, isAccepted: boolean) => {
			if (isAccepted) {
				return true;
			}

			return this.dialogService.confirm({
				timeout,
				cancel: this.stringsService.decline,
				content: `${
					this.stringsService.p2pRequest
				} ${
					<string> (
						(<any> this.stringsService)[callType + 'Call'] ||
						''
					)
				}. ${
					this.stringsService.p2pWarning
				}`,
				ok: this.stringsService.continueDialogAction,
				title: this.stringsService.p2pTitle
			});
		},
		connected: (isConnected: boolean) => {
			if (isConnected) {
				this.chatService.addMessage(
					this.stringsService.p2pConnect,
					users.app,
					undefined,
					false
				);
			}
			else {
				this.dialogService.alert({
					content: this.stringsService.p2pDisconnect,
					ok: this.stringsService.ok,
					title: this.stringsService.p2pTitle
				});

				this.chatService.addMessage(
					this.stringsService.p2pDisconnect,
					users.app,
					undefined,
					false
				);
			}
		},
		requestConfirm: async (callType: string, isAccepted: boolean) => {
			if (isAccepted) {
				return true;
			}

			return this.dialogService.confirm({
				cancel: this.stringsService.cancel,
				content: `${
					this.stringsService.p2pInit
				} ${
					<string> (
						(<any> this.stringsService)[callType + 'Call'] ||
						''
					)
				}. ${
					this.stringsService.p2pWarning
				}`,
				ok: this.stringsService.continueDialogAction,
				title: this.stringsService.p2pTitle
			});
		},
		requestConfirmation: () => {
			this.chatService.addMessage(
				this.stringsService.p2pRequestConfirmation,
				users.app,
				undefined,
				false
			);
		},
		requestRejection: () => {
			this.dialogService.alert({
				content: this.stringsService.p2pDeny,
				ok: this.stringsService.ok,
				title: this.stringsService.p2pTitle
			});
		}
	};

	/** Indicates whether P2P is possible (i.e. both clients support WebRTC). */
	public isEnabled: boolean	= false;

	/** Indicates whether sidebar is open. */
	public isSidebarOpen: boolean;

	/** Close active P2P session. */
	public closeButton () : void {
		if (this.sessionInitService.callType === undefined) {
			this.p2pWebRTCService.close();
		}
		else {
			this.chatService.disconnectButton();
		}
	}

	/** If chat authentication is complete, alert that P2P is disabled. */
	public disabledAlert () : void {
		if (this.chatService.chat.isConnected && !this.isEnabled) {
			this.dialogService.alert({
				content: this.stringsService.p2pDisabled,
				ok: this.stringsService.ok,
				title: this.stringsService.p2pTitle
			});
		}
	}

	/** Initialise service. */
	public async init (localVideo: () => JQuery, remoteVideo: () => JQuery) : Promise<void> {
		if (this.sessionInitService.callType !== undefined) {
			this.p2pWebRTCService.accept(this.sessionInitService.callType);
		}

		this.p2pWebRTCService.init(this.handlers, localVideo, remoteVideo);

		this.isEnabled	= (await this.sessionCapabilitiesService.capabilities).p2p;
	}

	/** @see P2PWebRTCService.isActive */
	public get isActive () : boolean {
		return this.p2pWebRTCService.isActive;
	}

	/** Toggle visibility of sidebar containing chat UI. */
	public toggleSidebar () : void {
		this.isSidebarOpen	= !this.isSidebarOpen;
	}

	/**
	 * Attempt to toggle outgoing video stream,
	 * requesting new P2P session if necessary.
	 */
	public videoCallButton () : void {
		if (!this.isEnabled) {
			return;
		}

		if (!this.p2pWebRTCService.isActive) {
			this.p2pWebRTCService.request('video');
		}
		else {
			this.p2pWebRTCService.toggle(undefined, 'video');
		}
	}

	/**
	 * Attempt to toggle outgoing audio stream,
	 * requesting new P2P session if necessary.
	 */
	public voiceCallButton () : void {
		if (!this.isEnabled) {
			return;
		}

		if (!this.p2pWebRTCService.isActive) {
			this.p2pWebRTCService.request('audio');
		}
		else {
			this.p2pWebRTCService.toggle(undefined, 'audio');
		}
	}

	constructor (
		/** @ignore */
		private readonly chatService: ChatService,

		/** @ignore */
		private readonly dialogService: DialogService,

		/** @ignore */
		private readonly p2pWebRTCService: P2PWebRTCService,

		/** @ignore */
		private readonly sessionCapabilitiesService: SessionCapabilitiesService,

		/** @ignore */
		private readonly sessionInitService: SessionInitService,

		/** @ignore */
		private readonly stringsService: StringsService
	) {}
}
