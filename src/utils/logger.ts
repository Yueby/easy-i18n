/**
 * 日志工具
 * 封装日志输出，便于统一管理和格式化
 */

import { name as packageName } from '../../package.json' with { type: 'json' };

/**
 * 获取日志前缀
 * @returns 格式化的日志前缀
 */
function getPrefix(): string {
    return `[${packageName}]`;
}

/**
 * 输出调试信息
 * @param message 日志信息
 * @param optionalParams 额外参数
 */
function debug(message: string, ...optionalParams: any[]): void {
    console.debug(`${getPrefix()} ${message}`, ...optionalParams);
}

/**
 * 输出普通信息
 * @param message 日志信息
 * @param optionalParams 额外参数
 */
function info(message: string, ...optionalParams: any[]): void {
    console.info(`${getPrefix()} ${message}`, ...optionalParams);
}

/**
 * 输出警告信息
 * @param message 日志信息
 * @param optionalParams 额外参数
 */
function warn(message: string, ...optionalParams: any[]): void {
    console.warn(`${getPrefix()} ${message}`, ...optionalParams);
}

/**
 * 输出错误信息
 * @param message 日志信息
 * @param optionalParams 额外参数
 */
function error(message: string, ...optionalParams: any[]): void {
    console.error(`${getPrefix()} ${message}`, ...optionalParams);
}

// 导出logger对象的命名版本，这样既能保持兼容也能统一风格
export const logger = {
    debug,
    info,
    warn,
    error
};
