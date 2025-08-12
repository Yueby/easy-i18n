/**
 * @file config.ts
 * @description 全局配置文件，包含关键的常量和配置项
 */

import { name as packageName } from '../package.json' with { type: 'json' };

/**
 * 插件名称
 */
export const PACKAGE_NAME = packageName;

/**
 * 配置键名
 * 用于存储和读取项目配置
 */
export const CONFIG_KEY = {
    /**
     * 导出路径配置键名
     */
    EXPORT_PATH: 'exportPath'
};

/**
 * 默认值
 * 包含应用中使用的关键默认值
 */
export const DEFAULT = {
    /**
     * 默认导出路径
     */
    EXPORT_PATH: 'project://assets/resources/easy-i18n',
    
    /**
     * 默认JSON文件名
     */
    JSON_NAME: 'i18n-data'
};

/**
 * 路径相关配置
 * 用于路径转换和处理
 */
export const PATH = {
    /**
     * 资源路径前缀
     */
    RESOURCES_PREFIX: 'project://assets/resources/',
    
};

/**
 * 插件相关常量
 * 用于构建钩子和资源处理
 */
export const PLUGIN = {
    /**
     * 移动资源目录名
     */
    MOVED_ASSETS_DIR: 'moved-assets',
    
    /**
     * 备份文件名
     */
    BACKUP_FILENAME: 'i18n-data-backup.json'
}; 