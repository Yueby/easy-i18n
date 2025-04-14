<script setup lang="ts">
import { defineEmits, defineProps, ref, watch } from 'vue';
import type { I18nItem, I18nItemValue, LanguageInfo } from '../../types/i18n';
import { logger } from '../../utils/logger';
import UiList from './common/UiList.vue';
import UiModal from './common/UiModal.vue';
import TranslationItem from './TranslationItem.vue';

interface Props {
    /**
     * 翻译键列表
     */
    translations: { key: string, item: I18nItem; }[];

    /**
     * 支持的语言列表
     */
    languages: LanguageInfo[];
}

// 定义组件属性
const props = defineProps<Props>();

// 定义事件
const emit = defineEmits<{
    /**
     * 翻译键列表变更时触发
     */
    (e: 'update:translations', translations: { key: string, item: I18nItem; }[]): void;

    /**
     * 翻译键变化时触发
     */
    (e: 'change', translations: { key: string, item: I18nItem; }[]): void;
}>();

// 当前选中的翻译键索引
const selectedKeyIndex = ref(-1);

// 监听翻译键列表变化，自动选择第一个键
watch(() => props.translations, (translations) => {
    // 当列表不为空且没有选中项时，选择第一个
    if (translations.length > 0 && selectedKeyIndex.value === -1) {
        selectedKeyIndex.value = 0;
    }
    // 如果列表为空，重置选择
    else if (translations.length === 0 && selectedKeyIndex.value !== -1) {
        selectedKeyIndex.value = -1;
        logger.info('翻译键列表为空，清除选择');
    }
    // 如果当前选中的索引超出范围，重置为第一个
    else if (selectedKeyIndex.value >= translations.length && translations.length > 0) {
        selectedKeyIndex.value = 0;
        logger.info('选中索引超出范围，重置为第一个:', translations[0].key);
    }
}, { immediate: true });

// 删除模态窗口控制
const showDeleteKeyModal = ref(false);
const keyToDeleteIndex = ref(-1);

// 添加键模态窗口控制
const showAddKeyModal = ref(false);
const newKeyName = ref('');
const newKeyDefaultValue = ref('');
const keyError = ref('');

// 处理选择翻译键
const handleSelectKey = (_: { key: string, item: I18nItem; }, index: number) => {
    selectedKeyIndex.value = index;
};

// 添加翻译键
const handleAddKey = () => {
    newKeyName.value = '';
    newKeyDefaultValue.value = '';
    keyError.value = '';
    showAddKeyModal.value = true;
};

// 检查键名是否有效
const validateKeyName = (keyName: string): boolean => {
    // 不能为空
    if (!keyName.trim()) {
        keyError.value = '键名不能为空';
        return false;
    }

    // 检查格式 (允许字母、数字、点、下划线和短横线)
    if (!/^[a-zA-Z0-9_\-.]+$/.test(keyName)) {
        keyError.value = '键名只能包含字母、数字、点、下划线和短横线';
        return false;
    }

    // 检查是否已存在
    const exists = props.translations.some(item => item.key === keyName);
    if (exists) {
        keyError.value = '该键名已存在';
        return false;
    }

    // 清除错误提示
    keyError.value = '';
    return true;
};

// 确认添加新键
const confirmAddKey = () => {
    if (!validateKeyName(newKeyName.value)) {
        return; // 验证失败，不继续执行
    }

    // 创建新的翻译键对象
    const newKeyItem = {
        key: newKeyName.value,
        item: {
            type: 'text' as const,
            value: {} as Record<string, I18nItemValue>
        }
    };

    // 如果提供了默认值，且存在至少一种语言，则只为第一个语言设置默认值
    if (newKeyDefaultValue.value && props.languages.length > 0) {
        const firstLang = props.languages[0];
        newKeyItem.item.value[firstLang.code] = {
            text: newKeyDefaultValue.value,
            options: {}
        };
    }

    // 更新翻译列表
    const updatedTranslations = [...props.translations, newKeyItem];

    // 触发更新事件
    emit('update:translations', updatedTranslations);
    emit('change', updatedTranslations);

    // 选择新添加的项目
    selectedKeyIndex.value = updatedTranslations.length - 1;

    // 关闭模态窗口
    showAddKeyModal.value = false;
    logger.info('添加了新翻译键:', newKeyName.value);
};

// 删除翻译键
const handleRemoveKey = (_item: { key: string, item: I18nItem; }, index: number) => {
    keyToDeleteIndex.value = index;
    showDeleteKeyModal.value = true;
};

// 确认删除翻译键
const confirmDeleteKey = () => {
    if (keyToDeleteIndex.value < 0) return;

    const updatedTranslations = [...props.translations];
    updatedTranslations.splice(keyToDeleteIndex.value, 1);

    // 如果删除的是当前选中项，重置选中状态
    if (keyToDeleteIndex.value === selectedKeyIndex.value) {
        selectedKeyIndex.value = -1;
    } else if (keyToDeleteIndex.value < selectedKeyIndex.value) {
        // 如果删除的是选中项之前的元素，更新选中索引
        selectedKeyIndex.value--;
    }

    showDeleteKeyModal.value = false;
    keyToDeleteIndex.value = -1;

    // 触发更新事件
    emit('update:translations', updatedTranslations);
    emit('change', updatedTranslations);
};

// 取消删除翻译键
const cancelDeleteKey = () => {
    showDeleteKeyModal.value = false;
    keyToDeleteIndex.value = -1;
};

// 处理翻译文本变更
const handleTranslationTextChange = (langCode: string, value: string) => {
    if (selectedKeyIndex.value < 0) return;

    const updatedTranslations = [...props.translations];
    const currentItem = updatedTranslations[selectedKeyIndex.value].item;

    // 获取当前语言的值对象或创建新的
    const langValue = currentItem.value[langCode] || { text: '' };

    // 更新文本
    updatedTranslations[selectedKeyIndex.value].item = {
        ...currentItem,
        value: {
            ...currentItem.value,
            [langCode]: {
                ...langValue,
                text: value
            }
        }
    };

    // 触发更新事件
    emit('update:translations', updatedTranslations);
    emit('change', updatedTranslations);
};

// 处理选项变更
const handleOptionsChange = (langCode: string, options: any) => {
    if (selectedKeyIndex.value < 0) return;

    const updatedTranslations = [...props.translations];
    const currentItem = updatedTranslations[selectedKeyIndex.value].item;

    // 获取当前语言的值对象或创建新的
    const langValue = currentItem.value[langCode] || { text: '' };

    // 更新选项
    updatedTranslations[selectedKeyIndex.value].item = {
        ...currentItem,
        value: {
            ...currentItem.value,
            [langCode]: {
                ...langValue,
                options
            }
        }
    };

    // 触发更新事件
    emit('update:translations', updatedTranslations);
    emit('change', updatedTranslations);
};

// 更新项目类型
const updateItemType = (type: 'text' | 'sprite') => {
    if (selectedKeyIndex.value < 0) return;

    const updatedTranslations = [...props.translations];

    // 更新类型
    updatedTranslations[selectedKeyIndex.value].item = {
        ...updatedTranslations[selectedKeyIndex.value].item,
        type
    };

    // 触发更新事件
    emit('update:translations', updatedTranslations);
    emit('change', updatedTranslations);
};

// 监听语言列表变化
watch(() => props.languages, (newLanguages, oldLanguages) => {
    if (!props.translations.length) return;

    // 找出新增的语言
    const addedLanguages = newLanguages.filter(
        newLang => !oldLanguages.some(oldLang => oldLang.code === newLang.code)
    );

    // 找出被移除的语言
    const removedLanguages = oldLanguages.filter(
        oldLang => !newLanguages.some(newLang => newLang.code === oldLang.code)
    );

    if (addedLanguages.length === 0 && removedLanguages.length === 0) {
        return; // 没有变化，直接返回
    }

    // 更新翻译列表
    const updatedTranslations = [...props.translations];
    let hasChanges = false;

    // 处理每个翻译键
    updatedTranslations.forEach(trans => {
        // 清理已删除语言的翻译
        if (removedLanguages.length > 0) {
            removedLanguages.forEach(lang => {
                if (lang.code in trans.item.value) {
                    delete trans.item.value[lang.code];
                    hasChanges = true;
                }
            });
        }

        // 为新增语言初始化空值
        if (addedLanguages.length > 0) {
            addedLanguages.forEach(lang => {
                if (!(lang.code in trans.item.value)) {
                    trans.item.value[lang.code] = { text: '', options: {} };
                    hasChanges = true;
                }
            });
        }
    });

    if (hasChanges) {
        // 通知父组件数据已更新
        emit('update:translations', updatedTranslations);
        emit('change', updatedTranslations);
    }
}, { deep: true });

// 获取翻译预览
const getTranslationPreview = (item: { key: string, item: I18nItem; }) => {
    // 如果没有语言列表，返回空字符串
    if (!props.languages.length) return '';

    // 使用第一个语言的翻译
    const firstLangCode = props.languages[0].code;
    const translation = item.item.value[firstLangCode]?.text;

    // 如果翻译不存在或为空，返回特定提示
    if (!translation) return '(未翻译)';

    // 如果翻译太长，截断并添加省略号
    if (translation.length > 20) {
        return translation.substring(0, 20) + '...';
    }

    return translation;
};

// 验证翻译文本格式是否正确（针对sprite类型）
const validateSpriteText = (text: string): boolean => {
    if (!text) return true; // 空字符串是有效的（未设置资源）

    // UUID格式校验的正则表达式
    const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}(@[0-9a-f]+)?$/i;

    // 检查是否是组合格式
    if (text.includes(':')) {
        const parts = text.split(':');
        if (parts.length !== 2) return false;

        // 检查两部分是否都是有效的UUID
        return uuidRegex.test(parts[0]) && uuidRegex.test(parts[1]);
    }

    // 如果不是组合格式，检查整个字符串是否是有效UUID
    return uuidRegex.test(text);
};

// 检查所有翻译是否有效，返回无效的项目
const getInvalidTranslations = (): { key: string, langCode: string; }[] => {
    const invalidItems: { key: string, langCode: string; }[] = [];

    props.translations.forEach(translation => {
        // 如果是sprite类型，验证每个语言的文本
        if (translation.item.type === 'sprite') {
            props.languages.forEach(lang => {
                const text = translation.item.value[lang.code]?.text || '';
                if (text && !validateSpriteText(text)) {
                    invalidItems.push({
                        key: translation.key,
                        langCode: lang.code
                    });
                }
            });
        }
    });

    return invalidItems;
};

// 检查是否有无效的翻译
const hasInvalidTranslations = (): boolean => {
    return getInvalidTranslations().length > 0;
};

// 暴露验证方法给父组件
defineExpose({
    validateTranslations: hasInvalidTranslations,
    getInvalidTranslations
});
</script>

<template>
    <div class="translation-editor">
        <!-- 分栏面板 -->
        <div class="split-panel">
            <!-- 左侧面板就是UiList -->
            <UiList class="key-list left-panel" header="翻译键列表" :items="translations" :selectedIndex="selectedKeyIndex"
                :editable="true" :expand="true" :collapsible="false" :selectable="true" @select="handleSelectKey"
                @add="handleAddKey" @remove="handleRemoveKey">
                <template #item="{ item, selected }">
                    <div class="key-list-item">
                        <ui-label :class="{ 'selected-key': selected }" v-html="item.key">
                        </ui-label>
                        <div v-if="props.languages.length" class="translation-preview">
                            {{ getTranslationPreview(item) }}
                        </div>
                    </div>
                </template>
                <template #empty>
                    <ui-label>暂无翻译键</ui-label>
                </template>
            </UiList>

            <!-- 右侧面板 -->
            <div class="right-panel">
                <!-- 右侧内容区 - 显示选中的翻译内容 -->
                <div v-if="selectedKeyIndex >= 0" class="translation-edit">
                    <div class="translation-key-header">
                        <ui-label class="translation-key-title" v-html="translations[selectedKeyIndex].key"></ui-label>
                    </div>
                    <div class="translation-values">
                        <!-- 类型设置区 -->
                        <ui-prop>
                            <ui-label slot="label">类型</ui-label>
                            <ui-select slot="content" :value="translations[selectedKeyIndex].item.type"
                                @change="updateItemType($event.target.value)">
                                <option value="text">文本 (Text)</option>
                                <option value="sprite">图片 (Sprite)</option>
                            </ui-select>
                        </ui-prop>

                        <!-- 翻译内容区 -->
                        <ui-section header="翻译内容" expand>
                            <UiList class="no-border-list" :items="languages" :editable="false" :selectable="false">
                                <template #item="{ item: language }">
                                    <TranslationItem :keyName="translations[selectedKeyIndex].key"
                                        :item="translations[selectedKeyIndex].item" :languageCode="language.code"
                                        :languageName="language.name"
                                        @textChange="(value) => handleTranslationTextChange(language.code, value)"
                                        @optionsChange="(options) => handleOptionsChange(language.code, options)" />
                                </template>
                            </UiList>
                        </ui-section>
                    </div>
                </div>
                <div v-else class="content-placeholder">
                    <ui-label>选择一个翻译键以编辑翻译内容</ui-label>
                </div>
            </div>
        </div>

        <!-- 添加翻译键模态窗口 -->
        <UiModal v-model:visible="showAddKeyModal" title="添加翻译键" okText="添加" cancelText="取消" @ok="confirmAddKey">
            <div class="add-key-form">
                <ui-prop>
                    <ui-label slot="label">键名（Key）</ui-label>
                    <ui-input slot="content" v-model="newKeyName" placeholder="例如: common.button.submit"
                        @input="validateKeyName(newKeyName)" @compositionend="validateKeyName(newKeyName)"></ui-input>
                </ui-prop>

                <div v-if="keyError" class="error-message">{{ keyError }}</div>

                <ui-prop class="form-item-spaced">
                    <ui-label slot="label">默认值（可选）</ui-label>
                    <ui-input slot="content" v-model="newKeyDefaultValue"
                        :placeholder="`仅为${props.languages.length > 0 ? props.languages[0].name : '第一'}语言设置默认值`"
                        @compositionend="() => { }"></ui-input>
                </ui-prop>

                <div class="key-format-help">
                    <ui-label>键名格式说明：</ui-label>
                    <ul>
                        <li>推荐使用点分隔的命名方式，例如 "module.component.text"</li>
                        <li>建议按功能区域组织，例如 "common.button.submit"</li>
                        <li>只能包含字母、数字、点(.)、下划线(_)和短横线(-)</li>
                    </ul>
                </div>
            </div>
        </UiModal>

        <!-- 删除翻译键确认模态窗口 -->
        <UiModal v-model:visible="showDeleteKeyModal" title="删除确认" okText="删除" cancelText="取消" @ok="confirmDeleteKey"
            @cancel="cancelDeleteKey">
            <div class="delete-confirm-content">
                <ui-label>确定要删除翻译键
                    <span v-if="keyToDeleteIndex >= 0" class="key-to-delete">
                        {{ translations[keyToDeleteIndex].key }}
                    </span> 吗？
                </ui-label>
                <ui-label class="warning-text">此操作无法撤销，删除后相关翻译内容将永久丢失。</ui-label>
            </div>
        </UiModal>
    </div>
</template>

<style scoped>
.translation-editor {
    width: 100%;
    overflow: hidden;
    height: 320px;
    /* 使用固定高度 */
}

.split-panel {
    display: flex;
    height: calc(100% - 2px);
    /* 减去边框的高度，确保底部边框可见 */
    border: 1px solid var(--border-color, rgba(127, 127, 127, 0.2));
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 1px;
    /* 底部留出空间显示边框 */
}

.left-panel {
    flex: 2;
    border-right: 1px solid var(--border-color, rgba(127, 127, 127, 0.2)) !important;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.key-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    border: none;
    border-radius: 0;
}

.right-panel {
    flex: 3;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.content-placeholder {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    background-color: var(--background-color, rgba(50, 50, 50, 0.2));
    color: var(--dark-text-color, rgba(255, 255, 255, 0.5));
}

.selected-key {
    font-weight: bold;
}

.translation-edit {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 12px;
    overflow: hidden;
}

.translation-key-header {
    padding: 8px 0;
    border-bottom: 1px solid var(--border-color, rgba(127, 127, 127, 0.2));
    margin-bottom: 12px;
}

.translation-key-title {
    font-size: 16px;
    font-weight: bold;
}

.translation-values {
    flex: 1;
    overflow-y: auto;
    padding-right: 8px;
    min-height: 200px;
    /* 添加最小高度确保内容区域有足够空间 */
}

.warning-text {
    color: var(--warning-color, #ff9800);
    margin-top: 8px;
    font-size: 13px;
}

.delete-confirm-content {
    padding: 8px 0;
}

.key-to-delete {
    font-weight: bold;
    color: var(--danger-color, #f44336);
}

.add-key-form {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.error-message {
    color: var(--danger-color, #f44336);
    font-size: 12px;
    padding: 2px 0 4px 0;
    margin-top: -4px;
}

.form-item-spaced {
    margin-top: 2px;
}

.key-format-help {
    margin-top: 16px;
    background-color: rgba(0, 0, 0, 0.1);
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 13px;
}

.key-format-help ul {
    margin: 6px 0 0 0;
    padding-left: 18px;
    line-height: 1.5;
    opacity: 0.8;
}

.key-list-item {
    padding: 4px 8px;
    cursor: pointer;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
}

.translation-preview {
    font-size: 11px;
    opacity: 0.5;
    margin-top: 2px;
    font-style: italic;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
}

.no-border-list {
    border: none !important;
    margin: 0 !important;
}

.validation-warning {
    display: none;
}
</style>