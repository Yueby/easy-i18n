<script setup lang="ts">
import fs from 'fs';
import Papa from 'papaparse';
import path from 'path';
import { onMounted, ref, watch } from 'vue';
import { CONFIG_KEY, DEFAULT } from '../config';
import type { I18nItem, LanguageInfo } from '../types/i18n';
import { file } from '../utils/file';
import { logger } from '../utils/logger';
import { profile } from '../utils/profile';
import ControlPanel from './components/ControlPanel.vue';
import LanguageManager from './components/LanguageManager.vue';
import TranslationEditor from './components/TranslationEditor.vue';

// 默认导出路径
const defaultExportPath = DEFAULT.EXPORT_PATH;
const defaultJsonName = DEFAULT.JSON_NAME;
const exportPath = ref(defaultExportPath);

// 语言列表数据 - 初始化为空数组
const languages = ref<LanguageInfo[]>([]);

// 默认语言代码
const defaultLanguage = ref('');

// 当前选中的语言索引
const selectedLanguageIndex = ref(-1);

// 测试用的翻译键列表
const translationKeys = ref<{ key: string, item: I18nItem; }[]>([]);

// 加载配置的exportPath
const loadExportPath = async () => {
    const savedPath = await profile.getProject(CONFIG_KEY.EXPORT_PATH);
    if (savedPath) {
        exportPath.value = savedPath;
    }
};

// 保存配置的exportPath
const saveExportPath = async (path: string) => {
    await profile.setProject(CONFIG_KEY.EXPORT_PATH, path);
};

// 监听语言列表变化，自动处理默认语言
watch(languages, (newLanguages) => {
    // 如果添加了第一个语言，自动设为默认语言
    if (newLanguages.length === 1 && !defaultLanguage.value) {
        defaultLanguage.value = newLanguages[0].code;
    }
    // 如果删除了默认语言，且还有其他语言，则设置第一个为默认
    else if (newLanguages.length > 0 && !newLanguages.some(lang => lang.code === defaultLanguage.value)) {
        defaultLanguage.value = newLanguages[0].code;
    }
    // 如果没有语言了，清空默认语言
    else if (newLanguages.length === 0) {
        defaultLanguage.value = '';
    }
}, { deep: true });

// 监听exportPath变化，保存到项目配置，并同步到EasyI18n.ts
watch(exportPath, async (newPath) => {
    if (!newPath) return;
    
    await saveExportPath(newPath);
    
    // 只取相对于 resources 的路径部分
    // 例如 project://assets/resources/xxx => xxx
    const match = newPath.match(/^project:\/\/assets\/resources\/(.+)$/);
    const relativePath = match ? match[1] : 'easy-i18n/i18n-data';
    // 去掉末尾的 /，拼接文件名
    const i18nPath = relativePath.replace(/\/$/, '') + '/' + defaultJsonName;

    // 自动同步 assets/EasyI18n.ts 里的 I18N_DATA_PATH
    try {
        const pluginRoot = await file.getPluginRootDir();
        const easyI18nPath = path.join(pluginRoot, 'assets', 'EasyI18n.ts');
        let content = fs.readFileSync(easyI18nPath, 'utf-8');
        const newLine = `export const I18N_DATA_PATH: string = '${i18nPath}';`;
        content = content.replace(/export const I18N_DATA_PATH: string = '.*?';/, newLine);
        fs.writeFileSync(easyI18nPath, content, 'utf-8');
    } catch (error) {
        logger.error('自动同步 I18N_DATA_PATH 失败:', error);
    }
});

// 处理选择语言
const handleSelectLanguage = (_: LanguageInfo, index: number) => {
    selectedLanguageIndex.value = index;
};

// 处理语言列表变化
const handleLanguagesChange = (newLanguages: LanguageInfo[]) => {
    languages.value = newLanguages;
};

// 处理翻译键变更
const handleTranslationsChange = (newTranslations: { key: string, item: I18nItem; }[]) => {
    translationKeys.value = newTranslations;
};

// 初始化时加载配置
onMounted(async () => {
    // 从配置加载导出路径
    await loadExportPath();
    
    // 如果没有配置路径，设置一个默认路径并保存
    if (!exportPath.value) {
        exportPath.value = defaultExportPath;
        await saveExportPath(exportPath.value);
    }

    // 尝试加载保存的数据
    await loadSavedData();
});

// 加载保存的数据
const loadSavedData = async () => {
    try {
        if (!exportPath.value) {
            logger.warn('未设置导出目录，无法加载数据');
            return;
        }

        // 确保保存当前的路径配置
        await saveExportPath(exportPath.value);

        // 转换为db://格式用于API调用
        const url = exportPath.value.replace('project://', 'db://');

        // i18n数据文件路径
        const fileUrl = `${url}/${defaultJsonName}.json`;

        // 检查文件是否存在
        const fileInfo = await file.queryAssetInfo(fileUrl);
        if (!fileInfo) {
            logger.log('未找到已保存的数据文件');
            return;
        }

        // 获取文件在文件系统中的路径
        const filePath = await file.queryPath(fileUrl);
        if (!filePath) {
            logger.warn('无法获取数据文件的实际路径');
            return;
        }

        // 读取文件内容
        const content = file.readFile(filePath);
        if (!content) {
            logger.warn('读取数据文件内容失败');
            return;
        }

        // 解析JSON内容
        try {
            const i18nData = JSON.parse(content);

            // 加载语言列表
            if (i18nData.languages && Array.isArray(i18nData.languages)) {
                languages.value = i18nData.languages;
            }

            // 加载默认语言
            if (i18nData.defaultLanguage) {
                defaultLanguage.value = i18nData.defaultLanguage;
            }

            // 加载翻译键
            if (i18nData.items) {
                const translations = [];
                for (const key in i18nData.items) {
                    translations.push({
                        key,
                        item: i18nData.items[key]
                    });
                }
                translationKeys.value = translations;
            }

            // 自动选择第一个语言
            if (languages.value.length > 0) {
                selectedLanguageIndex.value = 0;
            }

            logger.log('已成功加载数据');
        } catch (e) {
            logger.error('解析数据JSON失败:', e);
        }
    } catch (error) {
        logger.error('加载数据时出错:', error);
    }
};

// 处理保存数据
const handleSaveData = async () => {
    if (!exportPath.value) {
        logger.warn('请先选择导出目录');
        return;
    }

    try {
        // 确保先保存路径配置
        await saveExportPath(exportPath.value);

        // 构建数据对象
        const i18nData = {
            languages: languages.value,
            defaultLanguage: defaultLanguage.value,
            items: {} as Record<string, I18nItem>
        };

        // 将翻译键列表转换为对象格式，并优化数据结构
        translationKeys.value.forEach(entry => {
            // 创建一个干净的item副本
            const cleanItem: I18nItem = {
                type: entry.item.type,
                value: {}
            };

            // 处理每种语言的数据
            Object.entries(entry.item.value).forEach(([langCode, langValue]) => {
                // 创建一个干净的语言值对象
                const cleanLangValue: any = {
                    text: langValue.text || '',
                    options: {} // 始终包含options对象，即使是空的
                };

                // 处理options，如果有效则填充
                if (langValue.options && Object.keys(langValue.options).length > 0) {
                    // 创建干净的options对象，去除空值
                    const cleanOptions: any = {};
                    let hasValidOptions = false;

                    // 处理基础选项
                    Object.entries(langValue.options).forEach(([key, value]) => {
                        // 跳过空值或默认值
                        if (value === undefined || value === null || value === '') {
                            return;
                        }

                        // 处理尺寸对象
                        if (key === 'contentSize' && typeof value === 'object') {
                            const size = value as any;
                            // 只有当宽高不都为0时才包含
                            if (!(size.width === 0 && size.height === 0)) {
                                cleanOptions.contentSize = {
                                    width: size.width || 0,
                                    height: size.height || 0
                                };
                                hasValidOptions = true;
                            }
                            return;
                        }

                        // 处理锚点对象
                        if (key === 'anchorPoint' && typeof value === 'object') {
                            const anchor = value as any;
                            // 只有当x和y不都为0时才包含
                            if (!(anchor.x === 0 && anchor.y === 0)) {
                                cleanOptions.anchorPoint = {
                                    x: anchor.x || 0,
                                    y: anchor.y || 0
                                };
                                hasValidOptions = true;
                            }
                            return;
                        }

                        // 处理颜色属性 (ui-color返回格式为 [r,g,b,a])
                        if (key === 'color' && Array.isArray(value)) {
                            // 检查是否为默认黑色 [0,0,0,255] 或完全透明 [x,x,x,0]
                            const isDefaultBlack = value[0] === 0 && value[1] === 0 && value[2] === 0 && value[3] === 255;
                            const isTransparent = value[3] === 0;

                            // 只有非默认黑色和非透明才保留
                            if (!isDefaultBlack && !isTransparent) {
                                cleanOptions.color = value;
                                hasValidOptions = true;
                            }
                            return;
                        }

                        // 其他选项直接包含
                        cleanOptions[key] = value;
                        hasValidOptions = true;
                    });

                    // 如果有有效选项，则使用处理后的options对象
                    if (hasValidOptions) {
                        cleanLangValue.options = cleanOptions;
                    }
                }

                // 保存处理后的语言值
                cleanItem.value[langCode] = cleanLangValue;
            });

            // 保存处理后的item
            i18nData.items[entry.key] = cleanItem;
        });

        // 将数据格式化为JSON字符串
        const jsonContent = JSON.stringify(i18nData, null, 2);

        // 转换为db://格式用于API调用
        const url = exportPath.value.replace('project://', 'db://');

        // 创建i18n数据文件路径
        const fileUrl = `${url}/${defaultJsonName}.json`;

        // 检查文件是否已存在
        const fileInfo = await file.queryAssetInfo(fileUrl);

        let result;
        if (fileInfo) {
            // 文件已存在，使用save-asset更新内容
            result = await file.saveAsset(fileUrl, jsonContent);
        } else {
            // 文件不存在，直接创建新文件(不检查父文件夹是否存在)
            result = await file.createAsset(fileUrl, jsonContent);
        }

        if (result) {
            logger.log('数据保存成功!', fileUrl);
            // 确保在成功保存后再次更新路径配置，以防之前的保存失败
            await saveExportPath(exportPath.value);
        } else {
            logger.error('保存数据失败');
        }
    } catch (error) {
        logger.error('保存数据失败:', error);
    }
};

// 处理CSV导入 - 接收ControlPanel传来的路径和选中语言
const handleImportCsv = async (csvPath: string, selectedLanguages: string[]) => {
    try {
        logger.log('开始导入CSV文件:', csvPath);
        logger.log('选中导入的语言:', selectedLanguages);

        // 读取CSV文件内容
        let csvContent: string;
        try {
            csvContent = fs.readFileSync(csvPath, 'utf-8');
        } catch (error) {
            logger.error('读取CSV文件失败:', error);
            return;
        }

        // 解析CSV内容
        const parseResult = Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
            transform: (value: string) => value.trim()
        });

        if (parseResult.errors.length > 0) {
            logger.error('CSV解析错误:', parseResult.errors);
            return;
        }

        const csvData = parseResult.data as any[];
        logger.log('CSV解析成功，数据行数:', csvData.length);

        // 验证CSV格式
        if (csvData.length === 0) {
            logger.warn('CSV文件为空');
            return;
        }

        const firstRow = csvData[0];
        if (!firstRow.key || !firstRow.type) {
            logger.error('CSV格式错误：缺少必要的key或type列');
            return;
        }

        // 提取语言列（除了key和type之外的所有列）
        const csvLanguages = Object.keys(firstRow).filter(key => key !== 'key' && key !== 'type');
        
        // 过滤出选中的语言
        const filteredLanguages = csvLanguages.filter(lang => selectedLanguages.includes(lang));
        
        if (filteredLanguages.length === 0) {
            logger.warn('没有找到选中的语言列');
            return;
        }

        // 更新语言列表 - 只添加选中的语言
        const existingLanguages = [...languages.value];
        filteredLanguages.forEach(langCode => {
            // 检查是否已存在该语言
            const existingLang = existingLanguages.find(lang => lang.code === langCode);
            if (!existingLang) {
                // 添加新语言
                existingLanguages.push({
                    code: langCode,
                    name: langCode // 使用语言代码作为名称，用户可以后续修改
                });
                logger.log('添加新语言:', langCode);
            }
        });

        // 如果没有默认语言，设置第一个语言为默认
        if (!defaultLanguage.value && existingLanguages.length > 0) {
            defaultLanguage.value = existingLanguages[0].code;
        }

        // 更新语言列表
        languages.value = existingLanguages;

        // 处理翻译数据
        const updatedTranslations = [...translationKeys.value];
        let addedCount = 0;
        let updatedCount = 0;

        csvData.forEach(row => {
            const key = row.key;
            const type = row.type;

            if (!key || !type) {
                logger.warn('跳过无效行:', row);
                return;
            }

            // 查找是否已存在该翻译键
            const existingIndex = updatedTranslations.findIndex(item => item.key === key);

            if (existingIndex >= 0) {
                // 更新现有翻译键 - 只更新选中语言的text内容，保留options
                const existingItem = updatedTranslations[existingIndex];

                // 更新类型（如果不同）
                existingItem.item.type = type as 'text' | 'sprite';

                // 只处理选中的语言
                filteredLanguages.forEach(langCode => {
                    const rawText = row[langCode] || '';
                    // 将CSV中的\n字符串转换为实际的换行符
                    const newText = rawText.replace(/\\n/g, '\n');

                    if (existingItem.item.value[langCode]) {
                        // 保留现有的options，只更新text
                        existingItem.item.value[langCode].text = newText;
                    } else {
                        // 创建新的语言条目
                        existingItem.item.value[langCode] = {
                            text: newText,
                            options: {}
                        };
                    }
                });

                updatedCount++;
                logger.log('更新翻译键:', key);
            } else {
                // 添加新翻译键
                const newItem: { key: string, item: I18nItem; } = {
                    key,
                    item: {
                        type: type as 'text' | 'sprite',
                        value: {}
                    }
                };

                // 只处理选中的语言
                filteredLanguages.forEach(langCode => {
                    const rawText = row[langCode] || '';
                    // 将CSV中的\n字符串转换为实际的换行符
                    const text = rawText.replace(/\\n/g, '\n');
                    newItem.item.value[langCode] = {
                        text,
                        options: {}
                    };
                });

                updatedTranslations.push(newItem);
                addedCount++;
                logger.log('添加新翻译键:', key);
            }
        });

        // 更新翻译键列表
        translationKeys.value = updatedTranslations;

        // 自动保存数据
        await handleSaveData();

        logger.log(`CSV导入完成 - 新增: ${addedCount}, 更新: ${updatedCount}`);

    } catch (error) {
        logger.error('CSV导入失败:', error);
    }
};

// 处理CSV导出
const handleExportCsv = async (csvPath: string) => {
    try {
        logger.log('开始导出CSV文件:', csvPath);

        if (languages.value.length === 0) {
            logger.warn('没有语言数据可导出');
            return;
        }

        if (translationKeys.value.length === 0) {
            logger.warn('没有翻译数据可导出');
            return;
        }

        // 构建CSV数据
        const csvData: any[] = [];

        // 构建header
        const languageCodes = languages.value.map(lang => lang.code);

        // 遍历所有翻译键
        translationKeys.value.forEach(translation => {
            const row: any = {
                key: translation.key,
                type: translation.item.type
            };

            // 为每种语言添加翻译内容
            languageCodes.forEach(langCode => {
                const langValue = translation.item.value[langCode];
                if (langValue) {
                    // 将实际换行符转换为\n字符串，便于CSV存储
                    const text = langValue.text.replace(/\n/g, '\\n');
                    row[langCode] = text;
                } else {
                    row[langCode] = '';
                }
            });

            csvData.push(row);
        });

        // 使用Papa.parse生成CSV内容
        const csvContent = Papa.unparse(csvData, {
            header: true,
            delimiter: ',',
            newline: '\r\n' // 使用Windows换行符，兼容性更好
        });

        // 写入CSV文件
        try {
            fs.writeFileSync(csvPath, csvContent, 'utf-8');
            logger.log(`CSV导出成功，共导出 ${csvData.length} 条翻译数据`);
            logger.log(`导出语言: ${languageCodes.join(', ')}`);
        } catch (writeError) {
            logger.error('写入CSV文件失败:', writeError);
            return;
        }

    } catch (error) {
        logger.error('CSV导出失败:', error);
    }
};

// 处理Options CSV导出
const handleExportOptionsCsv = async (csvPath: string) => {
    try {
        logger.log('开始导出Options CSV文件:', csvPath);

        if (languages.value.length === 0) {
            logger.warn('没有语言数据可导出');
            return;
        }

        if (translationKeys.value.length === 0) {
            logger.warn('没有翻译数据可导出');
            return;
        }

        // 构建CSV数据
        const csvData: any[] = [];

        // 构建header - key列 + 各语言code列
        const languageCodes = languages.value.map(lang => lang.code);

        // 遍历所有翻译键
        translationKeys.value.forEach(translation => {
            const row: any = {
                key: translation.key
            };

            // 为每种语言添加options内容
            languageCodes.forEach(langCode => {
                const langValue = translation.item.value[langCode];
                if (langValue && langValue.options && Object.keys(langValue.options).length > 0) {
                    // 将options对象转换为JSON字符串
                    row[langCode] = JSON.stringify(langValue.options);
                } else {
                    // 空options对象导出为空字符串
                    row[langCode] = '';
                }
            });

            csvData.push(row);
        });

        // 使用Papa.parse生成CSV内容
        const csvContent = Papa.unparse(csvData, {
            header: true,
            delimiter: ',',
            newline: '\r\n' // 使用Windows换行符，兼容性更好
        });

        // 写入CSV文件
        try {
            fs.writeFileSync(csvPath, csvContent, 'utf-8');
            logger.log(`Options CSV导出成功，共导出 ${csvData.length} 条翻译数据`);
            logger.log(`导出语言: ${languageCodes.join(', ')}`);
        } catch (writeError) {
            logger.error('写入Options CSV文件失败:', writeError);
            return;
        }

    } catch (error) {
        logger.error('Options CSV导出失败:', error);
    }
};

// 处理Options CSV导入 - 接收ControlPanel传来的路径和选中语言
const handleImportOptionsCsv = async (csvPath: string, selectedLanguages: string[]) => {
    try {
        logger.log('开始导入Options CSV文件:', csvPath);
        logger.log('选中导入的Options语言:', selectedLanguages);

        // 读取CSV文件内容，尝试多种编码
        let csvContent: string;
        try {
            // 首先尝试UTF-8编码
            csvContent = fs.readFileSync(csvPath, 'utf-8');

            // 检测是否包含乱码字符（简单检测）
            if (csvContent.includes('�') || csvContent.includes('锟斤拷')) {
                logger.warn('检测到UTF-8编码问题，尝试GBK编码');
                // 如果检测到乱码，尝试GBK编码
                const buffer = fs.readFileSync(csvPath);
                csvContent = buffer.toString('latin1');
                logger.log('使用GBK编码重新读取文件');
            }
        } catch (error) {
            logger.error('读取Options CSV文件失败:', error);
            return;
        }

        // 解析CSV内容
        const parseResult = Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
            transform: (value: string) => value.trim()
        });

        if (parseResult.errors && parseResult.errors.length > 0) {
            logger.error('CSV解析错误:', parseResult.errors);
            return;
        }

        const csvData = parseResult.data as any[];
        if (!csvData || csvData.length === 0) {
            logger.warn('CSV文件为空或无有效数据');
            return;
        }

        logger.log(`解析到 ${csvData.length} 条Options数据`);

        // 从CSV头部提取语言代码（除了key列）
        const csvHeaders = Object.keys(csvData[0]);
        const languageCodes = csvHeaders.filter(header => header !== 'key');

        // 过滤出选中的语言
        const filteredLanguages = languageCodes.filter(lang => selectedLanguages.includes(lang));
        
        if (filteredLanguages.length === 0) {
            logger.warn('没有找到选中的Options语言列');
            return;
        }

        // 处理每一行CSV数据
        csvData.forEach(row => {
            const key = row.key;
            if (!key) return;

            // 查找现有的翻译项
            let existingTranslation = translationKeys.value.find(t => t.key === key);

            if (existingTranslation) {
                // 更新现有翻译项的options - 只处理选中的语言
                filteredLanguages.forEach(langCode => {
                    const optionsJson = row[langCode];
                    if (optionsJson && optionsJson.trim()) {
                        try {
                            const options = JSON.parse(optionsJson);

                            // 确保语言值存在
                            if (!existingTranslation!.item.value[langCode]) {
                                existingTranslation!.item.value[langCode] = {
                                    text: '',
                                    options: {}
                                };
                            }

                            // 更新options，保留现有的text
                            existingTranslation!.item.value[langCode].options = options;
                            logger.log(`更新 ${key} 的 ${langCode} options`);
                        } catch (parseError) {
                            logger.warn(`解析 ${key} 的 ${langCode} options JSON失败:`, parseError);
                        }
                    }
                });
            } else {
                logger.warn(`翻译键 ${key} 不存在，跳过Options导入`);
            }
        });

        // 保存数据
        await handleSaveData();
        logger.log('Options CSV导入完成');

    } catch (error) {
        logger.error('Options CSV导入失败:', error);
    }
};

</script>

<template>
    <div class="container">
        <ui-label class="title" i18n>easy-i18n.title</ui-label>

        <!-- 控制面板 -->
        <ControlPanel v-model:exportPath="exportPath" @save="handleSaveData" @importCsv="handleImportCsv"
            @importOptionsCsv="handleImportOptionsCsv" @exportCsv="handleExportCsv"
            @exportOptionsCsv="handleExportOptionsCsv" />

        <!-- 语言管理器组件 -->
        <LanguageManager v-model:languages="languages" :selectedIndex="selectedLanguageIndex"
            v-model:defaultLanguage="defaultLanguage" @select="handleSelectLanguage" @change="handleLanguagesChange"
            @save="handleSaveData" />

        <!-- 翻译编辑器组件 - 只在有语言时显示 -->
        <TranslationEditor v-if="languages.length > 0" v-model:translations="translationKeys" :languages="languages"
            @change="handleTranslationsChange" @save="handleSaveData" />

        <!-- 当没有语言时显示提示信息 -->
        <div v-else class="no-language-tip">
            <ui-label>请先添加至少一种语言，然后才能进行翻译管理喵~</ui-label>
        </div>
    </div>
</template>

<style scoped>
.container {
    padding: 12px;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.title {
    font-size: 22px;
    font-weight: bold;
    margin-bottom: 16px;
    text-align: center;
}

.no-language-tip {
    margin-top: 20px;
    padding: 16px;
    text-align: center;
    background-color: rgba(50, 50, 50, 0.2);
    border-radius: 4px;
    border: 1px dashed rgba(127, 127, 127, 0.3);
}
</style>
