import { _decorator, Component, Enum, Label, Sprite } from 'cc';
import { EasyI18n, setOptions } from './EasyI18n';
import { ComponentType } from './I18nTypes';

const { ccclass, property } = _decorator;

@ccclass('I18nTranslator')
export class I18nTranslator extends Component {
	@property({
		visible: function (this: I18nTranslator): boolean {
			return this._componentType === ComponentType.LABEL;
		}
	})
	public label: Label = null;

	@property({
		visible: function (this: I18nTranslator): boolean {
			return this._componentType === ComponentType.SPRITE;
		}
	})
	public sprite: Sprite = null;

	@property({ type: Enum(ComponentType) })
	private _componentType: ComponentType = ComponentType.LABEL;

	@property({
		type: ComponentType
	})
	public get componentType(): ComponentType {
		const label = this.getComponent(Label);
		const sprite = this.getComponent(Sprite);

		if (label) {
			this.label = label;
			this._componentType = ComponentType.LABEL;
		} else if (sprite) {
			this.sprite = sprite;
			this._componentType = ComponentType.SPRITE;
		}

		return this._componentType;
	}

	public set componentType(value: ComponentType) {
		this._componentType = value;
	}

	@property({
		tooltip: '是否在加载时自动翻译'
	})
	public translateOnLoad: boolean = true;

	@property({
		tooltip: '翻译键值'
	})
	public key: string = '';

	@property({
		visible: function (this: I18nTranslator): boolean {
			return this.key !== '';
		}
	})
	public get translate(): boolean {
		return false;
	}

	public set translate(value: boolean) {
		this.translateI18n();
	}

	protected onLoad(): void {
		if (this.translateOnLoad && this.key !== '') {
			this.translateI18n();
		}
	}

	/**
	 * 刷新翻译，可用于语言切换后手动刷新
	 */
	public refresh(): void {
		if (this.key !== '') {
			this.translateI18n();
		}
	}

	private async translateI18n(): Promise<void> {
		// 使用getter自动检测和更新组件类型
		const type = this.componentType;

		// 如果没有找到可用组件，显示错误并返回
		if (!this.label && !this.sprite) {
			console.error('[I18nTranslator] 未找到支持的组件类型，请确保该组件挂载在 Label 或 Sprite 节点上，或者手动指定组件引用');
			return;
		}

		// 根据组件类型执行相应的翻译
		if (type === ComponentType.LABEL) {
			await this.translateLabel();
		} else if (type === ComponentType.SPRITE) {
			await this.translateSprite();
		}
	}

	private async translateLabel(): Promise<void> {
		if (!this.label) return;

		this.label.string = await EasyI18n.getTextTranslation(this.key);
		const options = EasyI18n.getOptions(this.key, 'text');
		setOptions(this.label, options);

		if (options) {
			this.label.fontSize = options.fontSize ?? this.label.fontSize;
			this.label.lineHeight = options.lineHeight ?? this.label.lineHeight;
		}
	}

	private async translateSprite(): Promise<void> {
		if (!this.sprite) return;

		const spriteFrameInfo = await EasyI18n.getSpriteTranslation(this.key);
		if (!spriteFrameInfo) return;

		this.sprite.spriteAtlas = spriteFrameInfo.atlas;
		this.sprite.spriteFrame = spriteFrameInfo.spriteFrame;

		const options = EasyI18n.getOptions(this.key, 'sprite');
		setOptions(this.sprite, options);
	}
}
