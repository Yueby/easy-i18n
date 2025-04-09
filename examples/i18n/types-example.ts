export interface I18nOptions {
    color?: string;
    // 可以根据需要添加更多选项
}

export interface I18nItem {
    type: 'text' | 'sprite';
    value: {
        [language: string]: string;  // 支持任意语言代码作为key
    };
    options?: I18nOptions;
}

export interface I18nData {
    [key: string]: I18nItem;
}