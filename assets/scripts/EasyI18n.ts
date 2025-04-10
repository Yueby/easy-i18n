import { _decorator, JsonAsset, resources, SpriteAtlas } from 'cc';
import { I18nBaseOptions, I18nData, I18nItemType, II18nJsonProvider, II18nSpriteProvider, initSpriteProviderMap, SpriteFrameInfo } from "./I18nTypes";
const { ccclass, property } = _decorator;

const I18N_DATA_FILE_PATH: string = "i18n/i18n-data.json";
const I18N_ATLAS_PATH: string = "atlas/";

class InternalJsonProvider implements II18nJsonProvider {
    private _jsonAsset: JsonAsset | null = null;

    get jsonAsset(): JsonAsset | null {
        return this._jsonAsset;
    }

    constructor() {
        resources.load(I18N_DATA_FILE_PATH, JsonAsset, (err, asset) => {
            if (err) {
                error(`加载国际化数据失败: ${err}`);
            } else {
                this._jsonAsset = asset;
            }
        });
    }

    getJson(): JsonAsset | null {
        if (!this._jsonAsset) {
            warn("国际化数据尚未加载完成，返回默认空数据");
            return null;
        }

        return this._jsonAsset;
    }
}

class InternalSpriteProvider implements II18nSpriteProvider {
    public infoUuidMap: Map<string, SpriteFrameInfo> = new Map();
    public infoNameMap: Map<string, SpriteFrameInfo> = new Map();
    public atlasUuidMap: Map<string, SpriteAtlas> = new Map();

    public altases: SpriteAtlas[] = [];

    constructor() {
        resources.loadDir(I18N_ATLAS_PATH, SpriteAtlas, (err, assets) => {
            if (err) {
                error(`初始化加载图集列表失败: ${err}`);
            } else {
                for (const asset of assets) {
                    this.atlasUuidMap.set(asset.uuid, asset);
                    this.altases.push(asset);
                }

                initSpriteProviderMap(this);
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

export class EasyI18n {
    private _currentLanguage: string = '';
    private _data: I18nData | null = null;

    private _jsonProvider: II18nJsonProvider;
    private _spriteProvider: II18nSpriteProvider;

    public get jsonProvider() {
        return this._jsonProvider;
    }

    public get spriteProvider() {
        return this._spriteProvider;
    }

    private static _instance: EasyI18n;
    public static get instance() {
        if (!this._instance) {
            this._instance = new EasyI18n();
        }
        return this._instance;
    }

    public get currentLanguage() {
        return this._currentLanguage;
    }

    public get data() {
        return this._data;
    }

    constructor() {
        this.init(new InternalJsonProvider(), new InternalSpriteProvider());
    }

    public init(jsonProvider: II18nJsonProvider, spriteProvider: II18nSpriteProvider) {
        this._jsonProvider = jsonProvider;
        this._spriteProvider = spriteProvider;

        this._data = this._jsonProvider?.getJson()?.json as I18nData;
    }

    public static setup(jsonProvider: II18nJsonProvider, spriteProvider: II18nSpriteProvider) {
        EasyI18n.instance.init(jsonProvider, spriteProvider);
    }

    public static isKeyValid(key: string): boolean {
        return EasyI18n.instance.data?.items[key] !== undefined;
    }

    public static getTextTranslation(key: string): string {
        if (!EasyI18n.isKeyValid(key)) {
            error(`未找到翻译键值: '${key}'`);
            return "Translation Error";
        }

        const instance = EasyI18n.instance;
        const value = instance.data?.items[key].value[instance.currentLanguage];
        if (!value) {
            warn(`当前语言 '${instance.currentLanguage}' 未找到键值 '${key}' 的翻译`);
            return "Translation Error";
        }
        return value;
    }

    public static getSpriteTranslation(key: string): SpriteFrameInfo | null {
        if (!EasyI18n.isKeyValid(key)) {
            error(`未找到翻译键值: '${key}'`);
            return null;
        }

        const instance = EasyI18n.instance;
        const value = instance.data?.items[key].value[instance.currentLanguage];
        if (!value) {
            warn(`当前语言 '${instance.currentLanguage}' 未找到键值 '${key}' 的翻译`);
            return null;
        }

        if (value.includes(':')) {
            const result = value.split(':');
            const atlasUuid = result[0];
            const spriteFrameUuid = result[1];
            const atlas = instance.spriteProvider?.getAtlas(atlasUuid);
            const spriteFrame = atlas?.getSpriteFrame(spriteFrameUuid);

            return {
                atlas: atlas,
                spriteFrame: spriteFrame
            } as SpriteFrameInfo;
        } else {
            return instance.spriteProvider?.getSpriteFrameInfo(value);
        }
    }


    public static getOptions(key: string, type: I18nItemType): I18nBaseOptions | null {
        const instance = EasyI18n.instance;
        if (!instance.data) {
            error('多语言数据未加载');
            return null;
        }

        const item = instance.data?.items[key];
        if (!item) {
            error(`未找到翻译键值: '${key}'`);
            return null;
        }

        return item.options || null;
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

