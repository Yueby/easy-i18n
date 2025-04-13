import { _decorator, Sprite } from 'cc';

import { EDITOR } from 'cc/env';
import { EasyI18n, setOptions } from "./EasyI18n.ts";

const { ccclass, property } = _decorator;

@ccclass('I18nSprite')
export class I18nSprite extends Sprite {
	@property
	public key: string = '';

	protected start(): void {
		if (EDITOR) return;

		const spriteFrameInfo = EasyI18n.getSpriteTranslation(this.key);
		if (!spriteFrameInfo) return;
		this.spriteAtlas = spriteFrameInfo.atlas;
		this.spriteFrame = spriteFrameInfo.spriteFrame;

		const options = EasyI18n.getOptions(this.key, 'sprite');
		setOptions(this, options);
	}
}

