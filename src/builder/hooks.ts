import type { BuildHook } from '@cocos/creator-types/editor/packages/builder/@types/public';
import fs from 'fs';
import path from 'path';
import { CONFIG_KEY, DEFAULT, PLUGIN } from '../config';
import type { I18nData } from '../types/i18n';
import { file } from '../utils/file';
import { logger } from '../utils/logger';
import { profile } from '../utils/profile';
import { util } from '../utils/util';

export const throwError: BuildHook.throwError = true;

// 资源信息接口
interface ResourceInfo {
	atlasUuid?: string;
	spriteUuid?: string;
}

// 移动文件信息接口
interface MovedFileInfo {
	originalPath: string;
	tempPath: string;
	metaPath?: string;
	tempMetaPath?: string;
	uuid?: string;
	url?: string;
}

// 备份信息接口
interface BackupInfo {
	originalPath: string;
	backupPath: string;
	originalData: I18nData;
}

// 资源分析结果接口
interface ResourceAnalysis {
	defaultResources: Set<string>;
	nonDefaultResources: Set<string>;
	resourcesToMove: Set<string>;
}

// 存储临时移动的文件信息
let tempMovedFiles: MovedFileInfo[] = [];

// 存储备份的多语言文件信息
let backupI18nInfo: BackupInfo | null = null;

/**
 * 获取多语言JSON文件路径
 */
async function getI18nFilePath(): Promise<string> {
	// 从项目配置中获取路径
	const relativePath = await profile.getProject(CONFIG_KEY.EXPORT_PATH);
	if (!relativePath) {
		throw new Error(`未找到多语言文件路径配置，请先在面板中设置多语言文件路径`);
	}
	
	logger.warn(`原始路径: ${relativePath}`);

	// 构建完整的DB路径（添加JSON文件名）
	let dbPath: string;

	// 处理不同格式的路径
	if (relativePath.startsWith('project://')) {
		// 如果是project://格式，转换为db://格式
		const dbUrl = relativePath.replace('project://', 'db://');
		dbPath = `${dbUrl}/${DEFAULT.JSON_NAME}.json`;
		logger.warn(`project路径转换: ${relativePath} -> ${dbPath}`);
	} else if (relativePath.startsWith('db://')) {
		// 如果已经是db://格式，直接使用
		const baseUrl = relativePath.replace(/\/$/, ''); // 移除末尾的斜杠
		dbPath = `${baseUrl}/${DEFAULT.JSON_NAME}.json`;
		logger.warn(`db路径处理: ${relativePath} -> ${dbPath}`);
	} else {
		// 如果是相对路径，转换为db://格式
		const dbUrl = file.getAssetDbUrl(relativePath);
		if (!dbUrl) {
			logger.warn(`无法解析路径: ${relativePath}`);
			throw new Error(`无法解析多语言路径: ${relativePath}`);
		}
		dbPath = `${dbUrl}/${DEFAULT.JSON_NAME}.json`;
		logger.warn(`相对路径转换: ${relativePath} -> ${dbPath}`);
	}

	// 转换为文件系统路径
	logger.warn(`查询路径: ${dbPath}`);
	const fullPath = await file.queryPath(dbPath);
	if (!fullPath) {
		logger.warn(`路径不存在: ${dbPath}`);
		throw new Error(`多语言文件不存在: ${dbPath}`);
	}
	
	logger.warn(`最终文件路径: ${fullPath}`);
	return fullPath;
}

/**
 * 获取插件专用的临时目录
 */
function getPluginTempDir(): string {
	// 使用file工具中的getPluginTempDir函数
	const pluginTempDir = file.getPluginTempDir();
	file.ensureDir(pluginTempDir);
	return pluginTempDir;
}

/**
 * 解析资源UUID字符串
 */
function parseResourceUUIDs(text: string): ResourceInfo {
	if (!text) return {};

	// 处理带@符号的UUID (例如 c3e350db-9093-4213-8f3e-495adec80fee@f9941)
	const cleanText = text.split('@')[0]; // 只保留@前面的部分

	if (cleanText.includes(':')) {
		// 格式: atlasUuid:spriteUuid
		const [atlasUuid, spriteUuid] = cleanText.split(':');
		return { atlasUuid, spriteUuid };
	}

	// 只有spriteUuid
	return { spriteUuid: cleanText };
}

/**
 * 分析资源使用情况
 */
function analyzeResourceUsage(i18nData: I18nData): ResourceAnalysis {
	const defaultResources = new Set<string>();
	const nonDefaultResources = new Set<string>();

	// 遍历所有sprite类型的翻译项
	Object.values(i18nData.items)
		.filter((item) => item.type === 'sprite')
		.forEach((item) => {
			Object.entries(item.value).forEach(([langCode, langValue]) => {
				const { atlasUuid, spriteUuid } = parseResourceUUIDs(langValue.text);
				const targetSet = langCode === i18nData.defaultLanguage ? defaultResources : nonDefaultResources;

				if (atlasUuid) targetSet.add(atlasUuid);
				if (spriteUuid) targetSet.add(spriteUuid);
			});
		});

	// 计算需要移动的资源（非默认语言独有的资源）
	const resourcesToMove = new Set<string>();
	nonDefaultResources.forEach((uuid) => {
		if (!defaultResources.has(uuid)) {
			resourcesToMove.add(uuid);
		}
	});

	return {
		defaultResources,
		nonDefaultResources,
		resourcesToMove
	};
}

/**
 * 创建只包含默认语言的清理数据
 */
function createCleanedData(i18nData: I18nData): I18nData {
	const cleanedData: I18nData = {
		languages: i18nData.languages.filter((lang) => lang.code === i18nData.defaultLanguage),
		defaultLanguage: i18nData.defaultLanguage,
		items: {}
	};

	// 遍历所有翻译项，只保留默认语言内容
	Object.entries(i18nData.items).forEach(([key, item]) => {
		const defaultValue = item.value[i18nData.defaultLanguage];
		if (defaultValue) {
			cleanedData.items[key] = {
				type: item.type,
				value: { [i18nData.defaultLanguage]: defaultValue }
			};
		}
	});

	return cleanedData;
}

/**
 * 移动资源文件到临时目录
 */
async function moveResourcesToTemp(resourcesToMove: Set<string>, tempAssetsDir: string): Promise<void> {
	if (resourcesToMove.size === 0) {
		return;
	}

	logger.warn(`开始处理非默认语言资源，数量: ${resourcesToMove.size}`);

	for (const uuid of resourcesToMove) {
		try {
			// 处理UUID，确保没有@后缀
			const cleanUuid = uuid.split('@')[0];

			// 通过UUID查询资产信息
			const assetInfo = await file.queryAssetInfo(cleanUuid);

			if (!assetInfo) {
				logger.warn(`资产信息不存在: ${cleanUuid}`);
				continue;
			}

			// 获取资产的文件系统路径
			let assetPath: string | null = null;

			// 尝试两种方式获取路径
			if (assetInfo.url) {
				// 如果有URL，先尝试将URL转换为文件系统路径
				assetPath = file.assetDbUrlToPath(assetInfo.url);
			}

			// 如果从URL获取失败，尝试从UUID获取
			if (!assetPath || !fs.existsSync(assetPath)) {
				assetPath = await file.queryPath(assetInfo.uuid);
			}

			if (!assetPath || !fs.existsSync(assetPath)) {
				logger.warn(`无法获取有效的资产路径: ${cleanUuid}`);
				continue;
			}

			// 生成临时路径
			const fileName = path.basename(assetPath);
			const tempPath = path.join(tempAssetsDir, `${cleanUuid}_${fileName}`);

			// 复制文件到临时目录
			fs.copyFileSync(assetPath, tempPath);

			// 处理.meta文件
			const metaPath = `${assetPath}.meta`;
			let tempMetaPath: string | undefined;

			if (fs.existsSync(metaPath)) {
				tempMetaPath = `${tempPath}.meta`;
				fs.copyFileSync(metaPath, tempMetaPath);
			}

			// 记录移动信息
			tempMovedFiles.push({
				originalPath: assetPath,
				tempPath,
				metaPath: fs.existsSync(metaPath) ? metaPath : undefined,
				tempMetaPath,
				uuid: cleanUuid,
				url: assetInfo.url
			});

			// 删除原始资源
			if (assetInfo.url) {
				await file.deleteAsset(assetInfo.url);
			} else {
				logger.warn(`无法删除资源，缺少URL: ${cleanUuid}`);
			}
		} catch (error) {
			logger.error(`处理资源失败: ${uuid}`, error);
		}
	}

	logger.warn(`成功处理资源数量: ${tempMovedFiles.length}`);
}

/**
 * 恢复移动的资源文件
 */
async function restoreMovedResources(): Promise<void> {
	if (tempMovedFiles.length === 0) return;

	logger.warn(`开始恢复资源文件，数量: ${tempMovedFiles.length}`);

	let successCount = 0;
	let failedCount = 0;

	// 创建一个资源恢复队列
	const resourcesToRestore = [...tempMovedFiles];
	tempMovedFiles = []; // 清空原始数组，避免重复处理

	// 分批处理资源，每批处理10个
	const batchSize = 10;

	while (resourcesToRestore.length > 0) {
		// 取出一批资源
		const batch = resourcesToRestore.splice(0, batchSize);
		const batchPromises = [];

		for (const fileInfo of batch) {
			batchPromises.push(
				(async () => {
					try {
						if (!fs.existsSync(fileInfo.tempPath)) {
							logger.warn(`临时文件不存在: ${fileInfo.tempPath}`);
							return { success: false, fileInfo };
						}

						// 确保目标目录存在
						const targetDir = path.dirname(fileInfo.originalPath);
						if (!fs.existsSync(targetDir)) {
							try {
								fs.mkdirSync(targetDir, { recursive: true });
							} catch (dirError) {
								logger.error(`无法创建目标目录: ${targetDir}`, dirError);
								return { success: false, fileInfo };
							}
						}

						// 直接使用Node.js文件操作复制文件
						try {
							// 复制主文件
							fs.copyFileSync(fileInfo.tempPath, fileInfo.originalPath);

							// 复制meta文件
							if (fileInfo.tempMetaPath && fileInfo.metaPath && fs.existsSync(fileInfo.tempMetaPath)) {
								// 确保meta文件的目录存在
								const metaDir = path.dirname(fileInfo.metaPath);
								if (!fs.existsSync(metaDir)) {
									fs.mkdirSync(metaDir, { recursive: true });
								}
								fs.copyFileSync(fileInfo.tempMetaPath, fileInfo.metaPath);
							}

							return { success: true, fileInfo };
						} catch (copyError) {
							logger.error(`复制文件失败: ${fileInfo.originalPath}`, copyError);
							return { success: false, fileInfo };
						}
					} catch (error) {
						logger.error(`恢复资源失败: ${fileInfo.originalPath}`, error);
						return { success: false, fileInfo };
					}
				})()
			);
		}

		// 等待当前批次的所有资源处理完成
		const batchResults = await Promise.all(batchPromises);

		// 统计成功和失败的数量
		for (const result of batchResults) {
			if (result.success) {
				successCount++;
			} else {
				failedCount++;
				// 对于失败的资源，如果它们有临时文件，我们保留它们以便后续处理
				if (fs.existsSync(result.fileInfo.tempPath)) {
					tempMovedFiles.push(result.fileInfo);
				}
			}
		}

		// 在批次之间稍作暂停
		if (resourcesToRestore.length > 0) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	logger.warn(`资源恢复完成 - 成功: ${successCount}, 失败: ${failedCount}, 剩余待处理: ${tempMovedFiles.length}`);

	// 如果有失败的资源，记录它们的信息
	if (tempMovedFiles.length > 0) {
		logger.warn('以下资源恢复失败，将在下次构建时重试:');
		tempMovedFiles.forEach((file) => {
			logger.warn(`- ${file.originalPath}`);
		});
	}

	// 如果有成功恢复的资源，尝试刷新资源数据库
	if (successCount > 0) {
		try {
			// 刷新资源数据库，使编辑器能够识别新复制的文件
			// 注意：这里我们刷新整个assets目录，因为我们不知道具体哪些资源被修改了
			await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets');
			logger.warn('已刷新资源数据库');
		} catch (refreshError) {
			logger.warn('刷新资源数据库失败，可能需要手动刷新:', refreshError);
		}
	}
}

/**
 * 恢复原始多语言文件
 */
function restoreI18nFile(): void {
	if (!backupI18nInfo) return;

	try {
		if (fs.existsSync(backupI18nInfo.backupPath)) {
			fs.copyFileSync(backupI18nInfo.backupPath, backupI18nInfo.originalPath);
			logger.warn('已恢复原始多语言文件');
		} else {
			logger.warn('备份的多语言文件不存在，使用内存数据恢复');
			const originalContent = JSON.stringify(backupI18nInfo.originalData, null, 2);
			file.writeFile(backupI18nInfo.originalPath, originalContent);
		}

		backupI18nInfo = null;
	} catch (error) {
		logger.error('恢复多语言文件失败:', error);
	}
}

/**
 * 清理临时文件夹
 * @param removeAll 是否移除所有文件，包括未恢复的资源
 */
function cleanupTempFolder(removeAll = true): void {
	try {
		const pluginTempDir = getPluginTempDir();
		const tempAssetsDir = path.join(pluginTempDir, PLUGIN.MOVED_ASSETS_DIR);

		if (fs.existsSync(tempAssetsDir)) {
			if (removeAll) {
				// 完全清理临时目录
				fs.rmSync(tempAssetsDir, { recursive: true, force: true });
			} else if (tempMovedFiles.length === 0) {
				// 如果没有未恢复的资源，也可以完全清理
				fs.rmSync(tempAssetsDir, { recursive: true, force: true });
			} else {
				// 有未恢复的资源，只清理已恢复的资源
				// 读取目录中的所有文件
				const files = fs.readdirSync(tempAssetsDir);

				// 获取未恢复资源的文件名
				const unresolvedFileNames = new Set(tempMovedFiles.map((file) => path.basename(file.tempPath)));

				// 删除已恢复的资源文件
				for (const file of files) {
					const fullPath = path.join(tempAssetsDir, file);
					// 如果不是未恢复的资源文件，且不是备份的多语言文件，则删除
					if (!unresolvedFileNames.has(file) && file !== PLUGIN.BACKUP_FILENAME && !file.endsWith('.meta') && file !== 'failed_resources.json') {
						try {
							fs.unlinkSync(fullPath);
						} catch (e) {
							// 忽略删除失败的错误
						}
					}
				}
			}
		}
	} catch (error) {
		logger.warn('清理临时文件夹失败:', error);
	}
}

export const load: BuildHook.load = async function () {
	// 检查是否有上次构建未恢复的资源
	// try {
	// 	const pluginTempDir = getPluginTempDir();
	// 	const failedResourcesFile = path.join(pluginTempDir, 'failed_resources.json');
	// 	if (fs.existsSync(failedResourcesFile)) {
	// 		const content = fs.readFileSync(failedResourcesFile, 'utf-8');
	// 		const failedResources = JSON.parse(content);
	// 		if (Array.isArray(failedResources) && failedResources.length > 0) {
	// 			logger.warn(`发现上次构建有${failedResources.length}个资源未恢复，将在本次构建后重试`);
	// 			tempMovedFiles = failedResources;
	// 			// 删除记录文件
	// 			fs.unlinkSync(failedResourcesFile);
	// 		}
	// 	}
	// } catch (error) {
	// 	logger.error('加载未恢复资源信息失败:', error);
	// }
};

export const onBeforeBuild: BuildHook.onBeforeBuild = async function () {
	try {
		// 获取多语言文件路径
		let i18nDataPath;
		try {
			i18nDataPath = await getI18nFilePath();
		} catch (error: any) {
			logger.warn(`获取多语言文件路径失败: ${error.message}`);
			logger.warn(`错误详情:`, error);
			return;
		}

		// 检查并读取多语言文件
		if (!fs.existsSync(i18nDataPath)) {
			logger.warn(`多语言文件不存在，跳过资源处理: ${i18nDataPath}`);
			return;
		}

		const i18nContent = file.readFile(i18nDataPath);
		if (!i18nContent) {
			logger.warn('无法读取多语言文件');
			return;
		}

		const i18nData = util.safeJsonParse<I18nData>(i18nContent, {} as I18nData);
		if (!i18nData?.languages || !i18nData.defaultLanguage || !i18nData.items) {
			logger.warn('多语言文件格式错误');
			return;
		}

		// 创建插件专用临时目录
		const pluginTempDir = getPluginTempDir();
		const tempAssetsDir = path.join(pluginTempDir, PLUGIN.MOVED_ASSETS_DIR);
		file.ensureDir(tempAssetsDir);

		// 备份原始多语言文件
		const backupPath = path.join(tempAssetsDir, PLUGIN.BACKUP_FILENAME);
		fs.copyFileSync(i18nDataPath, backupPath);

		backupI18nInfo = {
			originalPath: i18nDataPath,
			backupPath,
			originalData: i18nData
		};

		// 分析资源使用情况
		const analysis = analyzeResourceUsage(i18nData);

		// 创建并写入清理后的多语言文件
		const cleanedData = createCleanedData(i18nData);
		const cleanedContent = JSON.stringify(cleanedData, null, 2);
		file.writeFile(i18nDataPath, cleanedContent);
		logger.warn(`已清理多语言文件，只保留默认语言: ${i18nData.defaultLanguage}`);

		// 移动非默认语言独有的图片资源
		await moveResourcesToTemp(analysis.resourcesToMove, tempAssetsDir);
	} catch (error) {
		logger.warn('onBeforeBuild 处理失败:', error);
	}
};

export const onAfterBuild: BuildHook.onAfterBuild = async function () {
	try {
		// 恢复原始多语言文件
		restoreI18nFile();

		// 使用非阻塞方式处理资源恢复，不使用await
		restoreMovedResources()
			.then(() => {
				// 如果仍有未恢复的资源，保存它们的信息以便下次构建时重试
				if (tempMovedFiles.length > 0) {
					try {
						// 创建一个持久化存储，记录未恢复的资源
						const pluginTempDir = getPluginTempDir();
						const failedResourcesFile = path.join(pluginTempDir, 'failed_resources.json');
						fs.writeFileSync(failedResourcesFile, JSON.stringify(tempMovedFiles, null, 2), 'utf-8');
						logger.warn(`已保存${tempMovedFiles.length}个未恢复资源的信息，下次构建时将重试`);
					} catch (error) {
						logger.error('保存未恢复资源信息失败:', error);
					}
				}

				// 清理临时文件夹 - 但保留未恢复的资源
				cleanupTempFolder(false);
			})
			.catch((error) => {
				logger.error('资源恢复失败:', error);
			});
	} catch (error) {
		logger.error('onAfterBuild 处理失败:', error);
	}
};

export const unload: BuildHook.unload = async function () {
	try {
		// 如果插件卸载时还有未恢复的文件，尝试恢复
		if (backupI18nInfo || tempMovedFiles.length > 0) {
			logger.warn('插件卸载时发现未恢复的文件，尝试恢复...');
			restoreI18nFile();

			// 使用非阻塞方式处理资源恢复
			restoreMovedResources()
				.then(() => {
					logger.warn('卸载时资源恢复完成');
					cleanupTempFolder();
				})
				.catch((error) => {
					logger.error('卸载时资源恢复失败:', error);
				});
		}
	} catch (error) {
		logger.error('unload 处理失败:', error);
	}
};
