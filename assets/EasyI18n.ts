import { _decorator, assetManager, Color, JsonAsset, resources, SpriteAtlas, SpriteFrame, UIRenderer, UITransform } from 'cc';
import { EDITOR_NOT_IN_PREVIEW } from 'cc/env';
import { ENABLE_LOG } from 'cc/userland/macro';
import { I18nBaseOptions, I18nData, I18nItemType, I18nSpriteOptions, I18nTextOptions, II18nJsonProvider, II18nSpriteProvider, SpriteFrameInfo } from './I18nTypes';

const { ccclass, property } = _decorator;

export const I18N_DATA_PATH: string = 'easy-i18n/i18n-data';
const I18N_TEXTURE_PATH: string = 'textures/';

class InternalJsonProvider implements II18nJsonProvider {
	private _json: string = '';

	get json(): string {
		return this._json;
	}

	async load(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			if (!EDITOR_NOT_IN_PREVIEW) {
				resources.load(I18N_DATA_PATH, JsonAsset, (err, asset) => {
					if (err) {
						error(`加载i18n数据失败: ${err}`);
						reject(err);
					} else {
						this._json = JSON.stringify(asset.json);

						// log('加载到i18n数据');
						resolve();
					}
				});
			} else {
				// @ts-ignore
				Editor.Message.request('asset-db', 'query-uuid', `db://assets/resources/${I18N_DATA_PATH}.json`)
					.then((uuid) => {
						if (uuid) {
							assetManager.loadAny(uuid, (err, asset) => {
								if (err) {
									error(`加载i18n数据失败: ${err}`);
									reject(err);
								} else {
									this._json = JSON.stringify(asset.json);
									// log('加载到i18n数据', this._json);
									resolve();
								}
							});
						} else {
							warn('i18n配置文件未找到', uuid);
							resolve();
						}
					})
					.catch((err) => {
						error(`查询i18n配置文件失败: ${err}`);
						resolve();
					});
			}
		});
	}

	getJson(): string {
		if (this._json === '') {
			warn('i18n数据为空，可能未加载完成');
		}
		return this._json;
	}
}

class InternalSpriteProvider implements II18nSpriteProvider {
	private infoUuidMap: Map<string, SpriteFrameInfo> = new Map();
	private atlasUuidMap: Map<string, SpriteAtlas> = new Map();
	private atlases: SpriteAtlas[] = [];

	async load(): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			if (!EDITOR_NOT_IN_PREVIEW) {
				// 先加载atlas
				resources.loadDir(I18N_TEXTURE_PATH, SpriteAtlas, (err, assets) => {
					if (err) {
						error(`初始化加载图集列表失败: ${err}`);
						reject(err);
					} else {
						for (const asset of assets) {
							this.atlasUuidMap.set(asset.uuid, asset);
							this.atlases.push(asset);
						}
						this.initSpriteProviderMap();
						// 再收集所有SpriteFrame
						resources.loadDir(I18N_TEXTURE_PATH, SpriteFrame, (err2, spriteFrames) => {
							if (!err2 && spriteFrames) {
								for (const spriteFrame of spriteFrames) {
									if (!this.infoUuidMap.has(spriteFrame.uuid)) {
										this.infoUuidMap.set(spriteFrame.uuid, {
											spriteFrame: spriteFrame,
											atlas: null
										});
									}
								}
							}
							resolve();
						});
					}
				});
			} else {
				// @ts-ignore
				Editor.Message.request('asset-db', 'query-assets', {
					pattern: `db://assets/resources/${I18N_TEXTURE_PATH}/**`,
					ccType: 'cc.SpriteAtlas'
				})
					.then((assetInfos) => {
						const assetUuids = assetInfos.map((info) => info.uuid);

						assetManager.loadAny(assetUuids, (err, result) => {
							if (err) {
								error(`初始化加载图集资源列表失败: ${err}`);
								reject(err);
							} else {
								let atlasList: SpriteAtlas[] = [];

								if (Array.isArray(result)) {
									atlasList = result;
								} else if (result) {
									atlasList.push(result);
								}

								for (const asset of atlasList) {
									this.atlasUuidMap.set(asset.uuid, asset);
									this.atlases.push(asset);
								}

								this.initSpriteProviderMap();
								// 再收集所有SpriteFrame
								// @ts-ignore
								Editor.Message.request('asset-db', 'query-assets', {
									pattern: `db://assets/resources/${I18N_TEXTURE_PATH}/**`,
									ccType: 'cc.SpriteFrame'
								}).then((spriteFrameInfos) => {
									// log('查询到的spriteFrameInfos:', spriteFrameInfos);
									const spriteFrameUuids = spriteFrameInfos.map((info) => info.uuid);
									assetManager.loadAny(spriteFrameUuids, (err2, result2) => {
										if (!err2 && result2) {
											let spriteFrameList: SpriteFrame[] = [];
											if (Array.isArray(result2)) {
												spriteFrameList = result2;
											} else if (result2) {
												spriteFrameList.push(result2);
											}
											// 过滤掉已存在于图集内的spriteFrame
											const independentSpriteFrames = spriteFrameList.filter((spriteFrame) => {
												const info = this.infoUuidMap.get(spriteFrame.uuid);
												return !info || !info.atlas;
											});
											// log(
											// 	'独立spriteFrame:',
											// 	independentSpriteFrames.map((sf) => ({ uuid: sf.uuid, name: sf.name }))
											// );
											for (const spriteFrame of independentSpriteFrames) {
												if (!this.infoUuidMap.has(spriteFrame.uuid)) {
													this.infoUuidMap.set(spriteFrame.uuid, {
														spriteFrame: spriteFrame,
														atlas: null
													});
												}
											}
										}
										resolve();
									});
								});
							}
						});
					})
					.catch((err) => {
						error(`查询图集资源列表失败: ${err}`);
						reject(err);
					});
			}
		});
	}

	private initSpriteProviderMap(): void {
		if (!this.atlases) return;
		for (const atlas of this.atlases) {
			this.atlasUuidMap.set(atlas.name, atlas);
			for (const spriteFrame of atlas.getSpriteFrames()) {
				if (!spriteFrame) continue;
				this.infoUuidMap.set(spriteFrame.uuid, {
					spriteFrame: spriteFrame,
					atlas: atlas
				});
			}
		}
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

	constructor() {}

	public async init(jsonProvider: II18nJsonProvider, spriteProvider: II18nSpriteProvider) {
		this._jsonProvider = jsonProvider;
		this._spriteProvider = spriteProvider;

		await this._jsonProvider.load();
		await this._spriteProvider.load();

		const jsonString = this._jsonProvider?.getJson();
		if (!jsonString || jsonString === '') {
			warn('i18n数据为空，初始化失败');
			return;
		}

		try {
			this._data = JSON.parse(jsonString) as I18nData;
			// console.log('init', this._data);
			if (!this._data) {
				error('初始化i18n管理器失败');
			}
		} catch (e) {
			error(`解析i18n数据失败: ${e}`);
		}
	}

	private async editorReload() {
		await this.init(this._jsonProvider, this._spriteProvider);
		// console.log('editorReload', this._data);
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
		if (EDITOR_NOT_IN_PREVIEW) {
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
		if (EDITOR_NOT_IN_PREVIEW) {
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
			const spriteFrame = getSpriteFrameByUuid(atlas, spriteFrameUuid);

			return {
				atlas: atlas,
				spriteFrame: spriteFrame
			} as SpriteFrameInfo;
		} else {
			return this.spriteProvider?.getSpriteFrameInfo(text);
		}
	}

	public getOptions(key: string, type: 'text'): I18nTextOptions | null;
	public getOptions(key: string, type: 'sprite'): I18nSpriteOptions | null;
	public getOptions(key: string, type: I18nItemType): I18nTextOptions | I18nSpriteOptions | null {
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

		switch (type) {
			case 'text':
				return (valueObj.options as I18nTextOptions) || null;
			case 'sprite':
				return (valueObj.options as I18nSpriteOptions) || null;
		}
	}
}

const useCustomI18n = false;
export const EasyI18n = new EasyI18nManager();
if (!useCustomI18n) {
	await EasyI18n.init(new InternalJsonProvider(), new InternalSpriteProvider());

	if (EDITOR_NOT_IN_PREVIEW) {
		log('使用默认多语言提供实现，如果想使用自定义实现，请在宏定义中定义CUSTOM_I18N并勾选。另外还需在resources目录中添加textures文件夹，并添加图集或SpriteFrame资源。');
	}
} else {
	if (EDITOR_NOT_IN_PREVIEW) {
		log('使用自定义多语言提供实现，如果想使用默认实现，请在宏定义中取消CUSTOM_I18N勾选或者删除宏定义。');
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
	}
	if (options.color) {
		target.color = new Color(options.color[0], options.color[1], options.color[2], options.color[3]);
	}
}

function log(message: string, ...args: any[]) {
	if (ENABLE_LOG) {
		return;
	}
	console.log(`[EasyI18n] ${message}`, ...args);
}

function warn(message: string, ...args: any[]) {
	if (ENABLE_LOG) {
		return;
	}
	console.warn(`[EasyI18n] ${message}`, ...args);
}

function error(message: string, ...args: any[]) {
	if (ENABLE_LOG) {
		return;
	}
	console.error(`[EasyI18n] ${message}`, ...args);
}

export function getSpriteFrameByUuid(spriteAtlas: SpriteAtlas, uuid: string): SpriteFrame | null {
	for (const spriteFrame of spriteAtlas.getSpriteFrames()) {
		if (spriteFrame.uuid === uuid) {
			return spriteFrame;
		}
	}
	return null;
}
