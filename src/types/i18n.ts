import type { Size, Vec2 } from './cc-types';

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
	color?: string;
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
export interface I18nSpriteOptions extends I18nBaseOptions {}

/**
 * 国际化项目类型
 */
export type I18nItemType = 'text' | 'sprite';

/**
 * 单一语言的翻译值及其配置
 */
export interface I18nItemValue {
	/**
	 * 文本内容或图片引用路径
	 */
	text: string;
	
	/**
	 * 该语言特有的UI配置选项
	 */
	options?: I18nBaseOptions & Partial<I18nTextOptions & I18nSpriteOptions>;
}

/**
 * 国际化项目接口
 */
export interface I18nItem {
	/**
	 * 项目类型：文本或精灵
	 */
	type: I18nItemType;

	/**
	 * 各语言的值和选项
	 */
	value: {
		[language: string]: I18nItemValue;
	};
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
