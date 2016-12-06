import {
	Directive,
	DoCheck,
	ElementRef,
	Inject,
	Injector,
	Input,
	OnChanges,
	OnDestroy,
	OnInit,
	SimpleChanges
} from '@angular/core';
import {UpgradeComponent} from '@angular/upgrade/static';


/**
 * ng2 wrapper for Material1 md-input-container + textarea.
 */
@Directive({
	/* tslint:disable-next-line:directive-selector */
	selector: 'md2-textarea'
})
export class MdTextarea
	extends UpgradeComponent implements DoCheck, OnChanges, OnInit, OnDestroy {
	/** Component title. */
	public static readonly title: string	= 'md2Textarea';

	/** Component configuration. */
	public static readonly config			= {
		bindings: {
			childClass: '@',
			disabled: '<',
			formName: '@',
			label: '@',
			model: '=',
			required: '<',
			rows: '@'
		},
		/* tslint:disable-next-line:max-classes-per-file */
		controller: class {
			/** @ignore */
			public readonly childClass: string;

			/** @ignore */
			public readonly disabled: boolean;

			/** @ignore */
			public readonly formName: string;

			/** @ignore */
			public readonly label: string;

			/** @ignore */
			public readonly model: string;

			/** @ignore */
			public readonly required: boolean;

			/** @ignore */
			public readonly rows: string;

			constructor () {}
		},
		template: `
			<md-input-container ng-class='$ctrl.childClass'>
				<label>{{$ctrl.label}}</label>
				<textarea
					ng-disabled='$ctrl.disabled'
					ng-attr-name='{{$ctrl.formName}}'
					ng-attr-aria-label='{{$ctrl.label}}'
					ng-model='$ctrl.model'
					ng-required='$ctrl.required'
					ng-attr-rows='{{$ctrl.rows}}'
				></textarea>
			</md-input-container>
		`
	};


	/** @ignore */
	@Input() public childClass: string;

	/** @ignore */
	@Input() public disabled: boolean;

	/** @ignore */
	@Input() public formName: string;

	/** @ignore */
	@Input() public label: string;

	/** @ignore */
	@Input() public model: string;

	/** @ignore */
	@Input() public required: boolean;

	/** @ignore */
	@Input() public rows: string;

	/** @ignore */
	public ngDoCheck () : void {
		super.ngDoCheck();
	}

	/** @ignore */
	public ngOnChanges (changes: SimpleChanges) : void {
		super.ngOnChanges(changes);
	}

	/** @ignore */
	public ngOnDestroy () : void {
		super.ngOnDestroy();
	}

	/** @ignore */
	public ngOnInit () : void {
		super.ngOnInit();
	}

	constructor (
		@Inject(ElementRef) elementRef: ElementRef,
		@Inject(Injector) injector: Injector
	) {
		super(MdTextarea.title, elementRef, injector);
	}
}
