module Cyph {
	export module UI {
		export module Directives {
			/**
			 * Angular directive for handling enter-presses.
			 */
			export class Enterpress {
				/** Module/directive title. */
				public static title: string	= 'cyphEnterpress';

				private static _	= (() => {
					angular.module(Enterpress.title, []).directive(Enterpress.title, () => ({
						restrict: 'A',
						scope: {
							trigger: '&' + Enterpress.title
						},
						link: (scope, element, attrs) => {
							const platformRestriction: string	= attrs['enterpressOnly'];

							if (!platformRestriction || platformRestriction === Cyph.Env.platformString) {
								element.keypress(e => {
									if (e.keyCode === 13 && !e.shiftKey) {
										e.preventDefault();
										scope['trigger']();
									}
								});
							}
						}
					}));
				})();
			}
		}
	}
}