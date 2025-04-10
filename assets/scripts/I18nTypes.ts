//#region CocosCreator简化类型

import { Color, JsonAsset, SpriteAtlas, SpriteFrame, UIRenderer, UITransform } from "cc";

export enum SpriteType {
    SIMPLE = 0,
    SLICED = 1,
    TILED = 2,
    FILLED = 3
}

export enum SizeMode {

    CUSTOM = 0,
    TRIMMED = 1,
    RAW = 2
}

export interface Size {
    width: number;
    height: number;
}

export interface Vec2 {
    x: number;
    y: number;
}

//#endregion

//#region 国际化类型

/**
 * 基础国际化选项接口
 */
export interface I18nBaseOptions {
    /**
     * 尺寸
     */
    contentSize?: Size;

    /**
     * 锚点
     */
    anchorPoint?: Vec2;

    /**
     * 文本颜色
     */
    color?: number[];
}

/**
 * 文本类型国际化选项
 */
export interface I18nTextOptions extends I18nBaseOptions {
    /**
     * 文本大小
     */
    fontSize?: number;

    lineHeight?: number;
}

/**
 * 精灵类型国际化选项
 */
export interface I18nSpriteOptions extends I18nBaseOptions { }

/**
 * 国际化项目类型
 */
export type I18nItemType = 'text' | 'sprite';

/**
 * 国际化项目接口
 */
export interface I18nItem {
    /**
     * 项目类型：文本或精灵
     */
    type: I18nItemType;

    /**
     * 各语言的值
     */
    value: {
        [language: string]: string; // 支持任意语言代码作为key
    };

    /**
     * 选项
     * 根据type字段的不同，实际类型可能是I18nTextOptions或I18nSpriteOptions
     */
    options?: I18nBaseOptions & Partial<I18nTextOptions & I18nSpriteOptions>;
}

/**
 * 语言信息接口
 */
export interface LanguageInfo {
    /**
     * 语言名称，如"简体中文"、"English"等
     */
    name: string;

    /**
     * 语言代码，如"zh"、"en"等
     */
    code: string;
}

/**
 * 国际化数据存储结构
 */
export interface I18nData {
    /**
     * 国际化项目数据
     */
    items: {
        [key: string]: I18nItem;
    };

    /**
     * 支持的语言列表
     */
    languages: LanguageInfo[];

    /**
     * 默认语言代码
     * 用于设置默认显示的语言和新建翻译键时的默认语言
     */
    defaultLanguage: string;
}
//#endregion

//#region 资源类型

export interface SpriteFrameInfo {
    spriteFrame: SpriteFrame;
    atlas: SpriteAtlas;
}

export interface II18nJsonProvider {

    /**
     * 获取国际化数据
     */
    getJson(): JsonAsset | null;
}

export interface II18nSpriteProvider {
    /**
     * 图集列表
     */
    altases?: SpriteAtlas[];

    /**
     * 图集缓存
     */
    atlasUuidMap: Map<string, SpriteAtlas>;

    /**
     * uuid缓存
     */
    infoUuidMap: Map<string, SpriteFrameInfo>;


    /**
     * 获取精灵帧
     * @param uuid 精灵帧的uuid或名称
     */
    getSpriteFrameInfo(uuid: string): SpriteFrameInfo | null;

    /**
     * 获取精灵图集
     * @param uuid 图集的uuid
     */
    getAtlas(uuid: string): SpriteAtlas | null;
}

export function initSpriteProviderMap(spriteProvider: II18nSpriteProvider): void {
    if (!spriteProvider.altases) return;
    if (!spriteProvider.atlasUuidMap) spriteProvider.atlasUuidMap = new Map();
    if (!spriteProvider.infoUuidMap) spriteProvider.infoUuidMap = new Map();

    for (const atlas of spriteProvider.altases) {
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

export function setOptions(target: UIRenderer, options: I18nBaseOptions|null): void {
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
        }
    }
}

//#endregion    
