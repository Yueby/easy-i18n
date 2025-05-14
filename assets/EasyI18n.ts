import { _decorator, assetManager, Color, JsonAsset, resources, SpriteAtlas, UIRenderer, UITransform } from 'cc';
import { EDITOR } from 'cc/env';
import { I18nBaseOptions, I18nData, I18nItemType, II18nJsonProvider, II18nSpriteProvider, SpriteFrameInfo } from './I18nTypes.ts';
const { ccclass, property } = _decorator;

const I18N_DATA_FILE_PATH: string = 'i18n/i18n-data';
const I18N_ATLAS_PATH: string = 'atlas/';

class InternalJsonProvider implements II18nJsonProvider {
	private _json: string = '';

	get json(): string {
		return this._json;
	}

	async load(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			if (!EDITOR) {
				resources.load(I18N_DATA_FILE_PATH, JsonAsset, (err, asset) => {
					if (err) {
						error(`加载国际化数据失败: ${err}`);
						reject(err);
					} else {
						this._json = JSON.stringify(asset.json);
						resolve();
					}
				});
			} else {
				// @ts-ignore
				const result = await Editor.Message.request('asset-db', 'query-uuid', `db://assets/resources/${I18N_DATA_FILE_PATH}.json`);
				if (result.uuid) {
					assetManager.loadAny(result, (err, asset) => {
						if (err) {
							error(`加载国际化数据失败: ${err}`);
							reject(err);
						} else {
							this._json = JSON.stringify(asset.json);
							resolve();
						}
					});
				} else {
					warn('配置文件未找到');
				}
			}
		});
	}

	getJson(): string {
		if (this._json === '') {
			warn('国际化数据尚未加载完成，返回默认空数据');
		}
		return this._json;
	}
}

class InternalSpriteProvider implements II18nSpriteProvider {
	public infoUuidMap: Map<string, SpriteFrameInfo> = new Map();
	public infoNameMap: Map<string, SpriteFrameInfo> = new Map();
	public atlasUuidMap: Map<string, SpriteAtlas> = new Map();

	public atlases: SpriteAtlas[] = [];

	async load(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			if (!EDITOR) {
				resources.loadDir(I18N_ATLAS_PATH, SpriteAtlas, (err, assets) => {
					if (err) {
						error(`初始化加载图集列表失败: ${err}`);
						reject(err);
					} else {
						for (const asset of assets) {
							this.atlasUuidMap.set(asset.uuid, asset);
							this.atlases.push(asset);
						}
						initSpriteProviderMap(this);
						resolve();
					}
				});
			} else {
				// @ts-ignore
				Editor.Message.request('asset-db', 'query-assets', {
					pattern: `db://assets/resources/${I18N_ATLAS_PATH}/**`,
					ccType: 'cc.SpriteAtlas'
				})
					.then((assetInfos) => {
						const assetUuids = assetInfos.map((info) => info.uuid);

						assetManager.loadAny(assetUuids, (err, atlsAssets) => {
							if (err) {
								error(`初始化加载图集列表失败: ${err}`);
								reject(err);
							} else {
								for (const asset of atlsAssets) {
									this.atlasUuidMap.set(asset.uuid, asset);
									this.atlases.push(asset);
								}

								initSpriteProviderMap(this);
								resolve();
							}
						});
					})
					.catch((err) => {
						error(`查询资源列表失败: ${err}`);
						reject(err);
					});
			}
		});
	}

	getSpriteFrameInfo(uuid: string): SpriteFrameInfo | null {
		const spriteFrameInfo = this.infoUuidMap.get(uuid);
		if (spriteFrameInfo) {
			return spriteFrameInfo;
		}
		return null;
	}

	getAtlas(uuid: string): SpriteAtlas | null {
		const atlas = this.atlasUuidMap.get(uuid);
		if (atlas) {
			return atlas;
		}
		return null;
	}
}

class EasyI18nManager {
	private _data: I18nData | null = null;

	private _jsonProvider: II18nJsonProvider;
	private _spriteProvider: II18nSpriteProvider;

	public get jsonProvider() {
		return this._jsonProvider;
	}

	public get spriteProvider() {
		return this._spriteProvider;
	}

	public get currentLanguage() {
		return this.data?.defaultLanguage || '';
	}

	public get data() {
		return this._data;
	}

	constructor() {
		this.init(new InternalJsonProvider(), new InternalSpriteProvider());
	}

	public async init(jsonProvider: II18nJsonProvider, spriteProvider: II18nSpriteProvider) {
		this._jsonProvider = jsonProvider;
		this._spriteProvider = spriteProvider;

		await this._jsonProvider.load();
		await this._spriteProvider.load();
		this._data = JSON.parse(this._jsonProvider?.getJson()) as I18nData;
		console.log(this._data);
	}

	private async editorReload() {
		await this.init(this._jsonProvider, this._spriteProvider);
		console.log('editorReload', this._data);
	}

	public async setup(jsonProvider: II18nJsonProvider, spriteProvider: II18nSpriteProvider) {
		await this.init(jsonProvider, spriteProvider);
	}

	public isKeyValid(key: string): boolean {
		if (!this.data) {
			error('多语言数据未加载');
			return false;
		}

		const item = this.data?.items[key];
		if (!item) {
			error(`未找到翻译键值: '${key}'`);
			return false;
		}

		return true;
	}

	public async getTextTranslation(key: string): Promise<string> {
		if (EDITOR) {
			await this.editorReload();
		}
		if (!this.isKeyValid(key)) {
			error(`未找到翻译键值: '${key}'`);
			return 'Translation Error';
		}

		const item = this.data?.items[key];
		if (!item) {
			error(`未找到翻译键值: '${key}'`);
			return 'Translation Error';
		}

		const valueObj = item.value[this.currentLanguage];
		if (!valueObj) {
			warn(`当前语言 '${this.currentLanguage}' 未找到键值 '${key}' 的翻译`);
			return 'Translation Error';
		}
		return valueObj.text;
	}

	public async getSpriteTranslation(key: string): Promise<SpriteFrameInfo | null> {
		if (EDITOR) {
			await this.editorReload();
		}

		if (!this.isKeyValid(key)) {
			error(`未找到翻译键值: '${key}'`);
			return null;
		}

		const valueObj = this.data?.items[key].value[this.currentLanguage];
		if (!valueObj) {
			warn(`当前语言 '${this.currentLanguage}' 未找到键值 '${key}' 的翻译`);
			return null;
		}

		const text = valueObj.text;
		if (text.includes(':')) {
			const result = text.split(':');
			const atlasUuid = result[0];
			const spriteFrameUuid = result[1];
			const atlas = this.spriteProvider?.getAtlas(atlasUuid);
			const spriteFrame = atlas?.getSpriteFrame(spriteFrameUuid);

			return {
				atlas: atlas,
				spriteFrame: spriteFrame
			} as SpriteFrameInfo;
		} else {
			return this.spriteProvider?.getSpriteFrameInfo(text);
		}
	}

	public getOptions(key: string, type: I18nItemType): I18nBaseOptions | null {
		if (!this.data) {
			error('多语言数据未加载');
			return null;
		}

		const item = this.data?.items[key];
		if (!item) {
			error(`未找到翻译键值: '${key}'`);
			return null;
		}

		const valueObj = item.value[this.currentLanguage];
		if (!valueObj) {
			warn(`当前语言 '${this.currentLanguage}' 未找到键值 '${key}' 的选项`);
			return null;
		}

		return valueObj.options || null;
	}
}

export const EasyI18n = new EasyI18nManager();

export function initSpriteProviderMap(spriteProvider: II18nSpriteProvider): void {
	if (!spriteProvider.atlases) return;
	if (!spriteProvider.atlasUuidMap) spriteProvider.atlasUuidMap = new Map();
	if (!spriteProvider.infoUuidMap) spriteProvider.infoUuidMap = new Map();

	for (const atlas of spriteProvider.atlases) {
		spriteProvider.atlasUuidMap.set(atlas.name, atlas);
		for (const spriteFrame of atlas.getSpriteFrames()) {
			if (!spriteFrame) continue;

			spriteProvider.infoUuidMap.set(spriteFrame.uuid, {
				spriteFrame: spriteFrame,
				atlas: atlas
			});
		}
	}
}

export function setOptions(target: UIRenderer, options: I18nBaseOptions | null): void {
	if (!target || !options) return;

	const uiTransform = target.getComponent(UITransform);
	if (uiTransform) {
		if (options.contentSize) {
			uiTransform.setContentSize(options.contentSize.width, options.contentSize.height);
		}
		if (options.anchorPoint) {
			uiTransform.setAnchorPoint(options.anchorPoint.x, options.anchorPoint.y);
		}

		if (options.color) {
			target.color = new Color(options.color[0], options.color[1], options.color[2], options.color[3]);
		} else {
			target.color = new Color(255, 255, 255, 255);
		}
	}
}

function log(message: string) {
	console.log(`[EasyI18n] ${message}`);
}

function warn(message: string) {
	console.warn(`[EasyI18n] ${message}`);
}

function error(message: string) {
	console.error(`[EasyI18n] ${message}`);
}
