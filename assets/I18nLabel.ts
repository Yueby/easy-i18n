import { _decorator, Label } from 'cc';

import { EDITOR } from 'cc/env';
import { EasyI18n, setOptions } from "./EasyI18n.ts";

const { ccclass, property } = _decorator;

@ccclass('I18nLabel')
export class I18nLabel extends Label {

	@property
	public key: string = '';

	@property
	public get translate(): boolean {
		return false;
	}

	public set translate(value: boolean) {
		this.translateI18n();
	}

	protected start(): void {
		if (EDITOR) return;

		this.translateI18n();
	}

	private async translateI18n(): Promise<void> {
		this.string = await EasyI18n.getTextTranslation(this.key);
		const options = EasyI18n.getOptions(this.key, 'text');
		setOptions(this, options);
		this.fontSize = options?.fontSize ?? this.fontSize;
		this.lineHeight = options?.lineHeight ?? this.lineHeight;
	}
}
