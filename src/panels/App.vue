<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { I18nItem, LanguageInfo } from '../types/i18n';
import { file } from '../utils/file';
import { logger } from '../utils/logger';
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

// 监听语言列表变化，自动处理默认语言
watch(languages, (newLanguages) => {
    // 如果添加了第一个语言，自动设为默认语言
    if (newLanguages.length === 1 && !defaultLanguage.value) {
        defaultLanguage.value = newLanguages[0].code;
        logger.info('自动设置第一个语言为默认语言:', newLanguages[0].name);
    }

    // 如果删除了默认语言，且还有其他语言，则设置第一个为默认
    if (newLanguages.length > 0 && !newLanguages.some(lang => lang.code === defaultLanguage.value)) {
        defaultLanguage.value = newLanguages[0].code;
        logger.info('默认语言已被删除，设置新的默认语言:', newLanguages[0].name);
    }

    // 如果没有语言了，清空默认语言
    if (newLanguages.length === 0 && defaultLanguage.value) {
        defaultLanguage.value = '';
        logger.info('已清空所有语言，清除默认语言设置');
    }
}, { deep: true });

// 处理选择语言
const handleSelectLanguage = (item: LanguageInfo, index: number) => {
    selectedLanguageIndex.value = index;
    logger.info('选择了语言:', item.name, `(${item.code})`);
};

// 处理语言列表变化
const handleLanguagesChange = (newLanguages: LanguageInfo[]) => {
    languages.value = newLanguages;
    logger.info('语言列表已更新，当前共有', newLanguages.length, '种语言');
};

// 处理翻译键变更
const handleTranslationsChange = (newTranslations: { key: string, item: I18nItem; }[]) => {
    translationKeys.value = newTranslations;
    logger.info('翻译键列表已更新');
};

// 初始化时检查目录是否存在
onMounted(() => {
    // 直接初始化测试数据，不检查目录
    initTestData();
});

// 仅在开发环境中初始化测试数据
const initTestData = () => {
    // 添加测试语言
    languages.value = [
        { name: '简体中文', code: 'zh' },
        { name: 'English', code: 'en' },
        { name: '日本語', code: 'ja' },
        { name: '한국어', code: 'ko' }
    ];

    // 设置默认语言
    defaultLanguage.value = 'zh';

    // 设置初始选中语言
    selectedLanguageIndex.value = 0;

    // 添加测试翻译键
    translationKeys.value = [
        {
            key: 'common.ok',
            item: {
                type: 'text',
                value: {
                    'zh': '确定',
                    'en': 'OK',
                    'ja': '確認',
                    'ko': '확인'
                }
            }
        },
        {
            key: 'common.cancel',
            item: {
                type: 'text',
                value: {
                    'zh': '取消',
                    'en': 'Cancel',
                    'ja': 'キャンセル',
                    'ko': '취소'
                }
            }
        },
        {
            key: 'common.save',
            item: {
                type: 'text',
                value: {
                    'zh': '保存',
                    'en': 'Save',
                    'ja': '保存',
                    'ko': '저장'
                }
            }
        },
        {
            key: 'game.start',
            item: {
                type: 'text',
                value: {
                    'zh': '开始游戏',
                    'en': 'Start Game',
                    'ja': 'ゲームを始める',
                    'ko': '게임 시작'
                }
            }
        },
        {
            key: 'game.settings',
            item: {
                type: 'text',
                value: {
                    'zh': '游戏设置',
                    'en': 'Game Settings',
                    'ja': 'ゲーム設定',
                    'ko': '게임 설정'
                }
            }
        }
    ];

    logger.info('已初始化测试数据');
};

// 处理目录选择变更
const handleDirectoryChange = (path: string) => {
    if (!path) return;

    // 只保存原始project://格式用于UI展示，不检查目录是否存在
    exportPath.value = path;
    logger.info('选择的导出目录:', path);
};

// 处理保存数据
const handleSaveData = async () => {
    if (!exportPath.value) {
        logger.warn('请先选择导出目录');
        return;
    }

    try {
        // 构建国际化数据对象
        const i18nData = {
            languages: languages.value,
            defaultLanguage: defaultLanguage.value,
            items: {} as Record<string, I18nItem>
        };

        // 将翻译键列表转换为对象格式
        translationKeys.value.forEach(entry => {
            i18nData.items[entry.key] = entry.item;
        });

        // 输出准备保存的数据
        logger.info('准备保存国际化数据:', i18nData);

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
            logger.info('文件已存在，更新内容...');
            result = await file.saveAsset(fileUrl, jsonContent);
        } else {
            // 文件不存在，直接创建新文件(不检查父文件夹是否存在)
            logger.info('尝试直接创建文件(包括必要的父文件夹)...');
            result = await file.createAsset(fileUrl, jsonContent);
        }

        if (result) {
            logger.info('✅ 国际化数据保存成功!', fileUrl);
            logger.info('资产信息:', {
                uuid: result.uuid,
                url: result.url,
                path: result.path,
                type: result.type
            });
        } else {
            logger.error('保存国际化数据失败');
        }
    } catch (error) {
        logger.error('保存国际化数据失败:', error);
    }
};
</script>

<template>
    <div class="container">
        <ui-label class="title" i18n>easy-i18n.title</ui-label>

        <ui-prop>
            <ui-label slot="label">文件保存目录</ui-label>

            <ui-file slot="content" type="directory" :value="exportPath" protocols="project" placeholder="选择国际化文件导出目录"
                @change="handleDirectoryChange($event.target.value)">
            </ui-file>

        </ui-prop>
        <ui-prop>
            <ui-label slot="label">保存文件</ui-label>
            <ui-button slot="content" @click="handleSaveData">
                <ui-icon value="save"></ui-icon>
            </ui-button>
            <ui-button slot="content" @click="handleSaveData">
                <ui-icon value="save"></ui-icon>
            </ui-button>
            <ui-button slot="content" @click="handleSaveData">
                <ui-icon value="save"></ui-icon>
            </ui-button>
        </ui-prop>

        <!-- 语言管理器组件 -->
        <LanguageManager v-model:languages="languages" :selectedIndex="selectedLanguageIndex"
            v-model:defaultLanguage="defaultLanguage" :dark="true" @select="handleSelectLanguage"
            @change="handleLanguagesChange" />

        <!-- 翻译编辑器组件 -->
        <TranslationEditor v-model:translations="translationKeys" :languages="languages" :dark="true"
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
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 16px;
}
</style>
