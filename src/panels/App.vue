<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { I18nItem, LanguageInfo } from '../types/i18n';
import { file } from '../utils/file';
import { logger } from '../utils/logger';
import { profile } from '../utils/profile';
import ControlPanel from './components/ControlPanel.vue';
import LanguageManager from './components/LanguageManager.vue';
import TranslationEditor from './components/TranslationEditor.vue';
import UiModal from './components/common/UiModal.vue';

// 默认导出路径
const defaultExportPath = 'project://assets/resources/easy-i18n';
const exportPath = ref(defaultExportPath);

// 语言列表数据 - 初始化为空数组
const languages = ref<LanguageInfo[]>([]);

// 默认语言代码
const defaultLanguage = ref('');

// 当前选中的语言索引
const selectedLanguageIndex = ref(-1);

// 测试用的翻译键列表
const translationKeys = ref<{ key: string, item: I18nItem; }[]>([]);

// 转移相关变量
const showTransferModal = ref(false);
const targetPath = ref('');
const transferMessage = ref('');
const isTransferring = ref(false);

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

// 处理转移文件
const handleTransferData = async () => {
    if (!exportPath.value) {
        logger.warn('请先选择当前的导出目录');
        return;
    }

    if (!targetPath.value) {
        logger.warn('请选择目标目录');
        return;
    }

    if (exportPath.value === targetPath.value) {
        transferMessage.value = '当前目录与目标目录相同，无需转移';
        return;
    }

    try {
        isTransferring.value = true;
        transferMessage.value = '正在转移文件...';

        // 源文件URL (db://格式)
        const sourceUrl = exportPath.value.replace('project://', 'db://');
        const sourceFileUrl = `${sourceUrl}/i18n-data.json`;

        // 目标文件URL (db://格式)
        const targetUrl = targetPath.value.replace('project://', 'db://');
        const targetFileUrl = `${targetUrl}/i18n-data.json`;

        // 检查源文件是否存在
        const fileInfo = await file.queryAssetInfo(sourceFileUrl);
        if (!fileInfo) {
            transferMessage.value = '源文件不存在，无法转移';
            isTransferring.value = false;
            return;
        }
        
        // 检查目标目录是否存在，不存在则创建
        const targetDirInfo = await file.queryAssetInfo(targetUrl);
        if (!targetDirInfo) {
            // 创建目标目录
            await file.createAsset(`${targetUrl}/`, null);
        }

        // 移动文件
        const success = await file.moveAsset(sourceFileUrl, targetFileUrl);
        
        if (success) {
            // 更新导出路径
            exportPath.value = targetPath.value;
            targetPath.value = '';
            transferMessage.value = '文件转移成功！';
            
            // 2秒后关闭模态窗口
            setTimeout(() => {
                showTransferModal.value = false;
                transferMessage.value = '';
                isTransferring.value = false;
            }, 2000);
        } else {
            transferMessage.value = '文件转移失败，请检查权限或目录是否有效';
            isTransferring.value = false;
        }
    } catch (error) {
        transferMessage.value = `转移过程出错: ${error}`;
        isTransferring.value = false;
        logger.error('转移文件失败:', error);
    }
};

// 处理目标路径变更
const handleTargetPathChange = (path: string) => {
    targetPath.value = path;
    transferMessage.value = '';
};

// 打开转移文件对话框
const openTransferDialog = () => {
    targetPath.value = '';
    transferMessage.value = '';
    isTransferring.value = false;
    showTransferModal.value = true;
};
</script>

<template>
    <div class="container">
        <ui-label class="title" i18n>easy-i18n.title</ui-label>

        <!-- 控制面板 -->
        <ControlPanel v-model:exportPath="exportPath" @save="handleSaveData" @transfer="openTransferDialog" />

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

        <!-- 转移文件对话框 -->
        <UiModal v-model:visible="showTransferModal" title="转移文件" okText="转移" cancelText="取消"
            @ok="handleTransferData" @cancel="showTransferModal = false">
            <div class="transfer-dialog">
                <ui-prop>
                    <ui-label slot="label">当前目录</ui-label>
                    <ui-input slot="content" readonly :value="exportPath"></ui-input>
                </ui-prop>

                <ui-prop>
                    <ui-label slot="label">目标目录</ui-label>
                    <ui-file slot="content" type="directory" :value="targetPath" protocols="project" 
                        placeholder="选择目标目录" @change="handleTargetPathChange($event.target.value)">
                    </ui-file>
                </ui-prop>

                <div v-if="transferMessage" class="transfer-message" :class="{ 'success': transferMessage.includes('成功') }">
                    {{ transferMessage }}
                </div>
            </div>
        </UiModal>
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

.transfer-dialog {
    padding: 8px 0;
}

.transfer-message {
    margin-top: 16px;
    padding: 8px 12px;
    background-color: rgba(255, 100, 100, 0.2);
    border-radius: 4px;
    text-align: center;
}

.transfer-message.success {
    background-color: rgba(100, 255, 100, 0.2);
}
</style>
