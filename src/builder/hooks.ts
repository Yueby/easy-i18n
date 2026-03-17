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
 * 注意：调用此函数前应该已经完成了英文填充，所以只需要分析默认语言的资源使用情况
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
 * 填充默认语言的空缺内容（使用英文作为fallback）
 * 这一步会修改原始数据，将英文内容填充到默认语言的空缺处
 */
function fillDefaultLanguageWithEnglish(i18nData: I18nData): void {
	if (i18nData.defaultLanguage === 'en') {
		return; // 如果默认语言就是英文，不需要填充
	}

	let fillCount = 0;

	Object.entries(i18nData.items).forEach(([key, item]) => {
		const defaultValue = item.value[i18nData.defaultLanguage];
		const englishValue = item.value['en'];

		// 如果默认语言不存在或内容为空，但英文有内容，用英文填充
		if ((!defaultValue || !defaultValue.text) && englishValue && englishValue.text) {
			item.value[i18nData.defaultLanguage] = englishValue;
			fillCount++;
			logger.warn(`翻译键 '${key}' 在默认语言 '${i18nData.defaultLanguage}' 中为空，使用英文内容填充`);
		}
	});

	if (fillCount > 0) {
		logger.warn(`共填充 ${fillCount} 个翻译项`);
	}
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
 * 恢复单个资源文件
 */
function restoreSingleResource(fileInfo: MovedFileInfo): boolean {
	try {
		if (!fs.existsSync(fileInfo.tempPath)) {
			logger.warn(`临时文件不存在: ${fileInfo.tempPath}`);
			return false;
		}

		const targetDir = path.dirname(fileInfo.originalPath);
		if (!fs.existsSync(targetDir)) {
			fs.mkdirSync(targetDir, { recursive: true });
		}

		fs.copyFileSync(fileInfo.tempPath, fileInfo.originalPath);

		if (fileInfo.tempMetaPath && fileInfo.metaPath && fs.existsSync(fileInfo.tempMetaPath)) {
			const metaDir = path.dirname(fileInfo.metaPath);
			if (!fs.existsSync(metaDir)) {
				fs.mkdirSync(metaDir, { recursive: true });
			}
			fs.copyFileSync(fileInfo.tempMetaPath, fileInfo.metaPath);
		}

		return true;
	} catch (error) {
		logger.error(`恢复资源失败: ${fileInfo.originalPath}`, error);
		return false;
	}
}

/**
 * 恢复移动的资源文件
 */
async function restoreMovedResources(): Promise<void> {
	if (tempMovedFiles.length === 0) return;

	const totalCount = tempMovedFiles.length;
	logger.warn(`开始恢复资源文件，数量: ${totalCount}`);

	const resourcesToRestore = [...tempMovedFiles];
	tempMovedFiles = [];

	let successCount = 0;
	const failedFiles: MovedFileInfo[] = [];
	const restoredDirs = new Set<string>();

	// 逐个同步恢复，避免并发问题
	for (const fileInfo of resourcesToRestore) {
		const success = restoreSingleResource(fileInfo);
		if (success) {
			successCount++;
			// 收集恢复文件所在的目录，用于后续按目录刷新
			const dbUrl = file.getAssetRelativePath(fileInfo.originalPath);
			if (dbUrl) {
				const dirUrl = dbUrl.substring(0, dbUrl.lastIndexOf('/'));
				restoredDirs.add(dirUrl);
			}
		} else if (fs.existsSync(fileInfo.tempPath)) {
			failedFiles.push(fileInfo);
		}
	}

	// 对失败的文件进行一次重试
	if (failedFiles.length > 0) {
		logger.warn(`首次恢复有 ${failedFiles.length} 个失败，进行重试...`);
		await new Promise((resolve) => setTimeout(resolve, 500));

		const retryFiles = [...failedFiles];
		failedFiles.length = 0;

		for (const fileInfo of retryFiles) {
			const success = restoreSingleResource(fileInfo);
			if (success) {
				successCount++;
				const dbUrl = file.getAssetRelativePath(fileInfo.originalPath);
				if (dbUrl) {
					const dirUrl = dbUrl.substring(0, dbUrl.lastIndexOf('/'));
					restoredDirs.add(dirUrl);
				}
			} else if (fs.existsSync(fileInfo.tempPath)) {
				failedFiles.push(fileInfo);
			}
		}
	}

	tempMovedFiles = failedFiles;

	logger.warn(`资源恢复完成 - 成功: ${successCount}/${totalCount}, 失败: ${tempMovedFiles.length}`);

	if (tempMovedFiles.length > 0) {
		logger.warn('以下资源恢复失败，将在下次构建时重试:');
		tempMovedFiles.forEach((f) => {
			logger.warn(`  - ${f.originalPath}`);
		});
	}

	// 按目录刷新 asset-db，比全局刷新更精准可靠
	if (successCount > 0) {
		for (const dirUrl of restoredDirs) {
			try {
				await Editor.Message.request('asset-db', 'refresh-asset', dirUrl);
			} catch (refreshError) {
				logger.warn(`刷新目录失败: ${dirUrl}`, refreshError);
			}
		}

		// 兜底：如果按目录刷新全部失败，尝试全局刷新
		if (restoredDirs.size === 0) {
			try {
				await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets');
			} catch (refreshError) {
				logger.warn('全局刷新资源数据库失败，可能需要手动刷新:', refreshError);
			}
		}

		logger.warn('已刷新资源数据库');
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
				const files = fs.readdirSync(tempAssetsDir);

				// 构建需要保留的文件集合（未恢复的主文件 + 对应 .meta 文件）
				const keepFileNames = new Set<string>();
				for (const movedFile of tempMovedFiles) {
					keepFileNames.add(path.basename(movedFile.tempPath));
					if (movedFile.tempMetaPath) {
						keepFileNames.add(path.basename(movedFile.tempMetaPath));
					}
				}

				const preserveFiles = new Set([PLUGIN.BACKUP_FILENAME, PLUGIN.MANIFEST_FILENAME, 'failed_resources.json']);

				for (const fileName of files) {
					if (keepFileNames.has(fileName) || preserveFiles.has(fileName)) {
						continue;
					}
					try {
						fs.unlinkSync(path.join(tempAssetsDir, fileName));
					} catch {
						// 忽略
					}
				}
			}
		}
	} catch (error) {
		logger.warn('清理临时文件夹失败:', error);
	}
}

/**
 * 尝试从 JSON 文件加载资源映射列表
 * 成功后删除源文件，解析失败也删除避免反复出错
 */
function loadResourceListFromFile(filePath: string): MovedFileInfo[] {
	try {
		const content = fs.readFileSync(filePath, 'utf-8');
		const parsed = JSON.parse(content);
		fs.unlinkSync(filePath);
		if (Array.isArray(parsed) && parsed.length > 0) {
			return parsed;
		}
	} catch {
		try { fs.unlinkSync(filePath); } catch { /* ignore */ }
	}
	return [];
}

export const load: BuildHook.load = async function () {
	try {
		const pluginTempDir = getPluginTempDir();
		const tempAssetsDir = path.join(pluginTempDir, PLUGIN.MOVED_ASSETS_DIR);

		// 1. 检查 failed_resources.json（上次 onAfterBuild 中资源恢复失败的记录）
		const failedResourcesFile = path.join(pluginTempDir, 'failed_resources.json');
		if (fs.existsSync(failedResourcesFile)) {
			const failedResources = loadResourceListFromFile(failedResourcesFile);
			if (failedResources.length > 0) {
				logger.warn(`发现上次构建有 ${failedResources.length} 个资源恢复失败，立即重试`);
				tempMovedFiles = failedResources;
				await restoreMovedResources();
				cleanupTempFolder(tempMovedFiles.length === 0);
			}
		}

		// 2. 检查 moved_manifest.json（崩溃场景：onBeforeBuild 完成但 onAfterBuild 未执行）
		const manifestFile = path.join(tempAssetsDir, PLUGIN.MANIFEST_FILENAME);
		if (fs.existsSync(manifestFile)) {
			const manifestResources = loadResourceListFromFile(manifestFile);
			if (manifestResources.length > 0) {
				logger.warn(`发现崩溃遗留的资源清单，共 ${manifestResources.length} 个资源需要恢复`);
				tempMovedFiles = manifestResources;
				await restoreMovedResources();
				cleanupTempFolder(tempMovedFiles.length === 0);
			}
		}

		// 3. 检查未恢复的多语言文件备份
		const backupFilePath = path.join(tempAssetsDir, PLUGIN.BACKUP_FILENAME);
		if (fs.existsSync(backupFilePath)) {
			logger.warn('发现未恢复的多语言文件备份，尝试确定原始路径并恢复');
			try {
				const relativePath = await profile.getProject(CONFIG_KEY.EXPORT_PATH);
				if (relativePath) {
					const i18nDataPath = await getI18nFilePath();
					if (i18nDataPath) {
						fs.copyFileSync(backupFilePath, i18nDataPath);
						fs.unlinkSync(backupFilePath);
						logger.warn('已从备份恢复多语言文件');
					}
				}
			} catch (restoreError) {
				logger.warn('自动恢复多语言文件失败，备份文件保留在临时目录:', restoreError);
			}
		}
	} catch (error) {
		logger.error('加载未恢复资源信息失败:', error);
	}
};

export const onBeforeBuild: BuildHook.onBeforeBuild = async function () {
	try {
		// 安全检查：如果上次构建遗留了未恢复的资源/文件，先恢复
		if (backupI18nInfo || tempMovedFiles.length > 0) {
			logger.warn('检测到上次构建遗留的未恢复状态，先执行恢复');
			restoreI18nFile();
			await restoreMovedResources();
			cleanupTempFolder(tempMovedFiles.length === 0);
		}

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
			originalData: JSON.parse(JSON.stringify(i18nData))
		};

		// 第一步：填充默认语言的空缺内容（使用英文作为fallback）
		fillDefaultLanguageWithEnglish(i18nData);

		// 第二步：分析资源使用情况（此时默认语言已经包含了填充的英文内容）
		const analysis = analyzeResourceUsage(i18nData);

		// 第三步：创建并写入清理后的多语言文件（只保留默认语言）
		const cleanedData = createCleanedData(i18nData);
		const cleanedContent = JSON.stringify(cleanedData, null, 2);
		file.writeFile(i18nDataPath, cleanedContent);
		
		// 根据是否使用英文fallback输出不同的日志
		if (i18nData.defaultLanguage === 'en') {
			logger.warn(`已清理多语言文件，只保留默认语言: ${i18nData.defaultLanguage}`);
		} else {
			logger.warn(`已清理多语言文件，只保留默认语言: ${i18nData.defaultLanguage}（缺失内容已用英文填充）`);
		}

		// 第四步：移动非默认语言独有的图片资源
		await moveResourcesToTemp(analysis.resourcesToMove, tempAssetsDir);

		// 持久化 manifest，确保崩溃后也能恢复资源
		if (tempMovedFiles.length > 0) {
			const manifestPath = path.join(tempAssetsDir, PLUGIN.MANIFEST_FILENAME);
			fs.writeFileSync(manifestPath, JSON.stringify(tempMovedFiles, null, 2), 'utf-8');
		}
	} catch (error) {
		logger.warn('onBeforeBuild 处理失败:', error);
	}
};

export const onAfterBuild: BuildHook.onAfterBuild = async function () {
	try {
		// 恢复原始多语言文件
		restoreI18nFile();

		// 阻塞等待资源恢复完成，确保所有文件都被恢复
		await restoreMovedResources();

		// 如果仍有未恢复的资源，保存它们的信息以便下次构建时重试
		if (tempMovedFiles.length > 0) {
			try {
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
	} catch (error) {
		logger.error('onAfterBuild 处理失败:', error);
	}
};

export const unload: BuildHook.unload = async function () {
	try {
		if (backupI18nInfo || tempMovedFiles.length > 0) {
			logger.warn('插件卸载时发现未恢复的文件，尝试恢复...');
			restoreI18nFile();
			await restoreMovedResources();
			cleanupTempFolder(tempMovedFiles.length === 0);
			logger.warn('卸载时资源恢复完成');
		}
	} catch (error) {
		logger.error('unload 处理失败:', error);
	}
};
