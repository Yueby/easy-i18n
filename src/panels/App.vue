<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { I18nItem, LanguageInfo } from '../types/i18n';
import { file } from '../utils/file';
import { logger } from '../utils/logger';
import { profile } from '../utils/profile';
import ControlPanel from './components/ControlPanel.vue';
import LanguageManager from './components/LanguageManager.vue';
import TranslationEditor from './components/TranslationEditor.vue';

// 默认导出路径
const defaultExportPath = 'project://assets/resources/i18n';
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
    const savedPath = await profile.getProject('exportPath');
    if (savedPath) {
        exportPath.value = savedPath;
    }
};

// 保存配置的exportPath
const saveExportPath = async (path: string) => {
    await profile.setProject('exportPath', path);
};

// 监听语言列表变化，自动处理默认语言
watch(languages, (newLanguages) => {
    // 如果添加了第一个语言，自动设为默认语言
    if (newLanguages.length === 1 && !defaultLanguage.value) {
        defaultLanguage.value = newLanguages[0].code;
    }

    // 如果删除了默认语言，且还有其他语言，则设置第一个为默认
    if (newLanguages.length > 0 && !newLanguages.some(lang => lang.code === defaultLanguage.value)) {
        defaultLanguage.value = newLanguages[0].code;
    }

    // 如果没有语言了，清空默认语言
    if (newLanguages.length === 0 && defaultLanguage.value) {
        defaultLanguage.value = '';
    }
}, { deep: true });

// 监听exportPath变化，保存到项目配置
watch(exportPath, async (newPath) => {
    if (newPath) {
        await saveExportPath(newPath);
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

        // 转换为db://格式用于API调用
        const url = exportPath.value.replace('project://', 'db://');
        
        // i18n数据文件路径
        const fileUrl = `${url}/i18n-data.json`;
        
        // 检查文件是否存在
        const fileInfo = await file.queryAssetInfo(fileUrl);
        if (!fileInfo) {
            logger.info('未找到已保存的数据文件');
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
            
            logger.info('已成功加载数据');
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
                    text: langValue.text || ''
                };
                
                // 只有当options不为空或null时才包含
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
                    
                    // 只有当有有效选项时才添加options对象
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
        const fileUrl = `${url}/i18n-data.json`;

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
            logger.info('数据保存成功!', fileUrl);
        } else {
            logger.error('保存数据失败');
        }
    } catch (error) {
        logger.error('保存数据失败:', error);
    }
};
</script>

<template>
    <div class="container">
        <ui-label class="title" i18n>easy-i18n.title</ui-label>

        <!-- 控制面板 -->
        <ControlPanel v-model:exportPath="exportPath" @save="handleSaveData" />

        <!-- 语言管理器组件 -->
        <LanguageManager v-model:languages="languages" :selectedIndex="selectedLanguageIndex"
            v-model:defaultLanguage="defaultLanguage" @select="handleSelectLanguage" @change="handleLanguagesChange" />

        <!-- 翻译编辑器组件 -->
        <TranslationEditor v-model:translations="translationKeys" :languages="languages"
            @change="handleTranslationsChange" />
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
</style>
