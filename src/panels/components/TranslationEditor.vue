<script setup lang="ts">
import { defineEmits, defineProps, ref, watch } from 'vue';
import type { I18nBaseOptions, I18nItem, I18nTextOptions, LanguageInfo } from '../../types/i18n';
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

    /**
     * 默认语言代码
     */
    defaultLanguage?: string;
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
        logger.info('自动选择第一个翻译键:', translations[0].key);
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
const handleSelectKey = (item: { key: string, item: I18nItem; }, index: number) => {
    selectedKeyIndex.value = index;
    logger.info('选择了翻译键:', item.key);
};

// 添加翻译键
const handleAddKey = () => {
    newKeyName.value = '';
    newKeyDefaultValue.value = '';
    keyError.value = '';
    showAddKeyModal.value = true;
    logger.info('打开添加翻译键对话框');
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
            value: {} as Record<string, string>,
            options: {} // 空对象，所有选项均为可选
        }
    };

    // 如果提供了默认值，且存在至少一种语言，则只为第一个语言设置默认值
    if (newKeyDefaultValue.value && props.languages.length > 0) {
        const firstLang = props.languages[0];
        newKeyItem.item.value[firstLang.code] = newKeyDefaultValue.value;
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

    const deletedKey = props.translations[keyToDeleteIndex.value].key;
    const updatedTranslations = [...props.translations];
    updatedTranslations.splice(keyToDeleteIndex.value, 1);

    // 如果删除的是当前选中项，重置选中状态
    if (keyToDeleteIndex.value === selectedKeyIndex.value) {
        selectedKeyIndex.value = -1;
    } else if (keyToDeleteIndex.value < selectedKeyIndex.value) {
        // 如果删除的是选中项之前的元素，更新选中索引
        selectedKeyIndex.value--;
    }

    logger.info('删除了翻译键:', deletedKey);
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
    updatedTranslations[selectedKeyIndex.value] = {
        ...updatedTranslations[selectedKeyIndex.value],
        item: {
            ...updatedTranslations[selectedKeyIndex.value].item,
            value: {
                ...updatedTranslations[selectedKeyIndex.value].item.value,
                [langCode]: value
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

    // 确保有选项对象
    if (!updatedTranslations[selectedKeyIndex.value].item.options) {
        updatedTranslations[selectedKeyIndex.value].item.options = {
            color: '#ffffff'
        };
    }

    // 更新类型
    updatedTranslations[selectedKeyIndex.value].item = {
        ...updatedTranslations[selectedKeyIndex.value].item,
        type
    };

    // 触发更新事件
    emit('update:translations', updatedTranslations);
    emit('change', updatedTranslations);

    logger.info('更新项目类型为:', type);
};

// 获取基础选项值
const getBaseOption = (key: keyof I18nBaseOptions): any => {
    if (selectedKeyIndex.value < 0) return undefined;

    const options = props.translations[selectedKeyIndex.value].item.options;
    if (!options) return undefined;

    return options[key];
};

// 更新基础选项
const updateBaseOption = (key: keyof I18nBaseOptions, value: any) => {
    if (selectedKeyIndex.value < 0) return;

    const updatedTranslations = [...props.translations];

    // 确保有选项对象
    if (!updatedTranslations[selectedKeyIndex.value].item.options) {
        updatedTranslations[selectedKeyIndex.value].item.options = {};
    }

    // 更新选项
    updatedTranslations[selectedKeyIndex.value].item.options = {
        ...updatedTranslations[selectedKeyIndex.value].item.options,
        [key]: value
    };

    // 触发更新事件
    emit('update:translations', updatedTranslations);
    emit('change', updatedTranslations);

    logger.info('更新基础选项:', key, value);
};

// 获取文本选项值
const getTextOption = (key: keyof I18nTextOptions): any => {
    if (selectedKeyIndex.value < 0) return undefined;

    const options = props.translations[selectedKeyIndex.value].item.options;
    if (!options) return undefined;

    return options[key];
};

// 更新文本选项
const updateTextOption = (key: keyof I18nTextOptions, value: any) => {
    if (selectedKeyIndex.value < 0) return;

    const updatedTranslations = [...props.translations];

    // 确保有选项对象
    if (!updatedTranslations[selectedKeyIndex.value].item.options) {
        updatedTranslations[selectedKeyIndex.value].item.options = {};
    }

    // 更新选项
    updatedTranslations[selectedKeyIndex.value].item.options = {
        ...updatedTranslations[selectedKeyIndex.value].item.options,
        [key]: value
    };

    // 触发更新事件
    emit('update:translations', updatedTranslations);
    emit('change', updatedTranslations);

    logger.info('更新文本选项:', key, value);
};

// 更新内容大小
const updateContentSize = (dimension: 'width' | 'height', value: number) => {
    if (selectedKeyIndex.value < 0) return;

    const updatedTranslations = [...props.translations];

    // 获取当前选项或创建空对象
    const currentOptions = updatedTranslations[selectedKeyIndex.value].item.options || {};

    // 获取当前的内容大小或创建新对象
    const currentSize = currentOptions.contentSize || { width: 0, height: 0 };

    // 更新选项
    updatedTranslations[selectedKeyIndex.value].item.options = {
        ...currentOptions,
        contentSize: {
            width: dimension === 'width' ? value : (currentSize.width || 0),
            height: dimension === 'height' ? value : (currentSize.height || 0)
        }
    };

    // 触发更新事件
    emit('update:translations', updatedTranslations);
    emit('change', updatedTranslations);

    logger.info('更新内容大小:', dimension, value);
};

// 更新锚点
const updateAnchorPoint = (dimension: 'x' | 'y', value: number) => {
    if (selectedKeyIndex.value < 0) return;

    const updatedTranslations = [...props.translations];

    // 获取当前选项或创建空对象
    const currentOptions = updatedTranslations[selectedKeyIndex.value].item.options || {};

    // 获取当前的锚点或创建新对象
    const currentAnchor = currentOptions.anchorPoint || { x: 0, y: 0 };

    // 更新选项
    updatedTranslations[selectedKeyIndex.value].item.options = {
        ...currentOptions,
        anchorPoint: {
            x: dimension === 'x' ? value : (currentAnchor.x || 0),
            y: dimension === 'y' ? value : (currentAnchor.y || 0)
        }
    };

    // 触发更新事件
    emit('update:translations', updatedTranslations);
    emit('change', updatedTranslations);

    logger.info('更新锚点:', dimension, value);
};

// 处理精灵图片变更
const handleSpriteImageChange = (langCode: string, uuid: string) => {
    // 由于图片资源是共用的，这里可以保存到某个地方或者记录下来
    console.log(`语言 ${langCode} 的图片资源变更为: ${uuid}`);
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
                    trans.item.value[lang.code] = '';
                    hasChanges = true;
                }
            });
        }
    });

    if (hasChanges) {
        // 通知父组件数据已更新
        emit('update:translations', updatedTranslations);
        emit('change', updatedTranslations);
        logger.info('已根据语言列表变化更新翻译数据');
    }
}, { deep: true });

// 获取默认语言的翻译预览
const getDefaultTranslationPreview = (item: { key: string, item: I18nItem; }) => {
    // 如果没有设置默认语言或没有语言列表，返回空字符串
    if (!props.defaultLanguage || !props.languages.length) return '';

    // 获取该键在默认语言中的翻译
    const translation = item.item.value[props.defaultLanguage];

    // 如果翻译不存在或为空，返回特定提示
    if (!translation) return '(未翻译)';

    // 如果翻译太长，截断并添加省略号
    if (translation.length > 20) {
        return translation.substring(0, 20) + '...';
    }

    return translation;
};
</script>

<template>
    <div class="translation-editor">
        <!-- 分栏面板 -->
        <div class="split-panel">
            <!-- 左侧面板就是UiList -->
            <UiList class="key-list left-panel" header="翻译键列表" :items="translations" :selectedIndex="selectedKeyIndex"
                :editable="true" :expand="true" :collapsible="false" @select="handleSelectKey" @add="handleAddKey"
                @remove="handleRemoveKey">
                <template #item="{ item, selected }">
                    <div class="key-list-item">
                        <ui-label :class="{ 'selected-key': selected }">
                            {{ item.key }}
                        </ui-label>
                        <div v-if="props.languages.length && props.defaultLanguage" class="default-translation">
                            {{ getDefaultTranslationPreview(item) }}
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
                        <ui-label class="translation-key-title">{{ translations[selectedKeyIndex].key }}</ui-label>
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
                                <template #item="{ item }">
                                    <TranslationItem :keyName="translations[selectedKeyIndex].key"
                                        :item="translations[selectedKeyIndex].item" :languageCode="item.code"
                                        :languageName="item.name"
                                        @textChange="(value) => handleTranslationTextChange(item.code, value)"
                                        @spriteChange="(uuid) => handleSpriteImageChange(item.code, uuid)" />
                                </template>
                            </UiList>
                        </ui-section>

                        <!-- 选项设置区 -->
                        <ui-section header="选项设置" expand>
                            <!-- 基础选项 -->
                            <div class="section-item">
                                <ui-section header="Content Size" expand class="sub-section">
                                    <div class="section-item">
                                        <ui-prop>
                                            <ui-label slot="label">Width</ui-label>
                                            <ui-num-input slot="content" style="width: 80px;"
                                                :value="getBaseOption('contentSize')?.width || 0"
                                                @change="updateContentSize('width', $event.target.value)"></ui-num-input>
                                        </ui-prop>
                                    </div>

                                    <div class="section-item">
                                        <ui-prop>
                                            <ui-label slot="label">Height</ui-label>
                                            <ui-num-input slot="content" style="width: 80px;"
                                                :value="getBaseOption('contentSize')?.height || 0"
                                                @change="updateContentSize('height', $event.target.value)"></ui-num-input>
                                        </ui-prop>
                                    </div>
                                </ui-section>
                            </div>

                            <div class="section-item">
                                <ui-section header="Anchor Point" expand class="sub-section">
                                    <div class="section-item">
                                        <ui-prop>
                                            <ui-label slot="label">X</ui-label>
                                            <ui-num-input slot="content" style="width: 80px;"
                                                :value="getBaseOption('anchorPoint')?.x || 0"
                                                @change="updateAnchorPoint('x', $event.target.value)"></ui-num-input>
                                        </ui-prop>
                                    </div>

                                    <div class="section-item">
                                        <ui-prop>
                                            <ui-label slot="label">Y</ui-label>
                                            <ui-num-input slot="content" style="width: 80px;"
                                                :value="getBaseOption('anchorPoint')?.y || 0"
                                                @change="updateAnchorPoint('y', $event.target.value)"></ui-num-input>
                                        </ui-prop>
                                    </div>
                                </ui-section>
                            </div>

                            <div class="section-item">
                                <ui-prop>
                                    <ui-label slot="label">Color</ui-label>
                                    <ui-color slot="content" :value="getBaseOption('color')"
                                        @change="updateBaseOption('color', $event.target.value)"></ui-color>
                                </ui-prop>
                            </div>

                            <!-- 文本类型特有选项 -->
                            <template v-if="translations[selectedKeyIndex].item.type === 'text'">
                                <div class="section-item">
                                    <ui-prop>
                                        <ui-label slot="label">Font Size</ui-label>
                                        <ui-num-input slot="content" :value="getTextOption('fontSize')"
                                            @change="updateTextOption('fontSize', $event.target.value)"></ui-num-input>
                                    </ui-prop>
                                </div>

                                <div class="section-item">
                                    <ui-prop>
                                        <ui-label slot="label">Line Height</ui-label>
                                        <ui-num-input slot="content" :value="getTextOption('lineHeight')"
                                            @change="updateTextOption('lineHeight', $event.target.value)"></ui-num-input>
                                    </ui-prop>
                                </div>
                            </template>

                            <!-- 精灵类型特有选项 -->
                            <template v-if="translations[selectedKeyIndex].item.type === 'sprite'">
                                <!-- 精灵选项已从I18nSpriteOptions接口中移除，现在只需要基础选项 -->
                            </template>
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
                        @input="validateKeyName(newKeyName)"></ui-input>
                </ui-prop>

                <div v-if="keyError" class="error-message">{{ keyError }}</div>

                <ui-prop class="form-item-spaced">
                    <ui-label slot="label">默认值（可选）</ui-label>
                    <ui-input slot="content" v-model="newKeyDefaultValue"
                        :placeholder="`仅为${props.languages.length > 0 ? props.languages[0].name : '第一'}语言设置默认值`"></ui-input>
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
    color: var(--highlight-color, #0078d4);
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

.section-item {
    margin-left: 12px;
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

/* 子部分样式 */
.sub-section {
    margin-left: 4px;
    margin-top: 4px;
    margin-bottom: 2px;
    border-left: 1px solid var(--border-color, rgba(127, 127, 127, 0.2));
}

.key-list-item {
    display: flex;
    flex-direction: column;
}

.default-translation {
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
</style>