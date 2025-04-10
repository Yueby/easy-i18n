import { _decorator, Label } from 'cc';

import { EDITOR } from 'cc/env';
import { EasyI18n } from "./EasyI18n";
import { setOptions } from "./I18nTypes";

const { ccclass, property } = _decorator;

@ccclass('I18nLabel')
export class I18nLabel extends Label {

	@property
	public key: string = '';

	protected start(): void {
		if (EDITOR) return;

		this.string = EasyI18n.getTextTranslation(this.key);
		const options = EasyI18n.getOptions(this.key, 'text');
		setOptions(this, options);
	}
}
