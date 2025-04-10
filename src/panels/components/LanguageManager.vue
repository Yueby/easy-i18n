<script setup lang="ts">
import { ref } from 'vue';
import type { LanguageInfo } from '../../types/i18n';
import { logger } from '../../utils/logger';
import UiList from './common/UiList.vue';
import UiModal from './common/UiModal.vue';

interface Props {
    /**
     * 语言列表数据
     */
    languages: LanguageInfo[];

    /**
     * 当前选中的语言索引
     */
    selectedIndex?: number;

    /**
     * 默认语言代码
     */
    defaultLanguage: string;
}

// 定义组件属性
const props = withDefaults(defineProps<Props>(), {
    selectedIndex: -1
});

// 定义事件
const emit = defineEmits<{
    /**
     * 语言列表变更时触发
     */
    (e: 'update:languages', languages: LanguageInfo[]): void;

    /**
     * 选择语言时触发
     */
    (e: 'select', item: LanguageInfo, index: number): void;

    /**
     * 语言列表有更新时触发
     */
    (e: 'change', languages: LanguageInfo[]): void;

    /**
     * 默认语言变更时触发
     */
    (e: 'update:defaultLanguage', code: string): void;
}>();

// 模态窗口控制
const showAddLanguageModal = ref(false);
const newLanguageName = ref('');
const newLanguageCode = ref('');

// 处理选择语言
const handleSelectLanguage = (item: LanguageInfo, index: number) => {
    emit('select', item, index);
};

// 打开添加语言模态窗口
const openAddLanguageModal = () => {
    newLanguageName.value = '';
    newLanguageCode.value = '';
    showAddLanguageModal.value = true;
};

// 添加语言确认
const confirmAddLanguage = () => {
    if (!newLanguageName.value || !newLanguageCode.value) {
        logger.warn('语言名称和代码不能为空');
        return;
    }

    // 创建新语言
    const newLanguage = {
        name: newLanguageName.value,
        code: newLanguageCode.value
    };

    // 更新语言列表
    const updatedLanguages = [...props.languages, newLanguage];

    // 触发更新事件
    emit('update:languages', updatedLanguages);
    emit('change', updatedLanguages);

    logger.info('添加了新语言:', newLanguageName.value, `(${newLanguageCode.value})`);
    showAddLanguageModal.value = false;
};

// 处理删除语言
const handleRemoveLanguage = (item: LanguageInfo, index: number) => {
    // 检查这个语言是否是默认语言
    const isDefault = isDefaultLanguage(item);

    // 创建更新后的语言列表
    const updatedLanguages = [...props.languages];
    updatedLanguages.splice(index, 1);

    // 触发更新事件
    emit('update:languages', updatedLanguages);
    emit('change', updatedLanguages);

    // 如果删除的是当前选中的语言，尝试选择第一个语言
    if (index === props.selectedIndex && updatedLanguages.length > 0) {
        emit('select', updatedLanguages[0], 0);
    }

    // 如果删除的是默认语言，且还有其他语言，设置第一个为默认
    if (isDefault && updatedLanguages.length > 0) {
        emit('update:defaultLanguage', updatedLanguages[0].code);
    } else if (updatedLanguages.length === 0) {
        // 如果没有语言了，清空默认语言
        emit('update:defaultLanguage', '');
    }

    logger.info('删除了语言:', item.name);
};

// 设置默认语言
const setAsDefaultLanguage = (index: number) => {
    if (index < 0 || index >= props.languages.length) return;

    const targetLanguage = props.languages[index];

    // 触发默认语言更新事件
    emit('update:defaultLanguage', targetLanguage.code);

    // 找到默认语言的索引
    const defaultIndex = props.languages.findIndex(lang => lang.code === targetLanguage.code);

    // 如果默认语言不在第一位，则重新排序
    if (defaultIndex > 0) {
        // 复制当前语言列表
        const updatedLanguages = [...props.languages];

        // 从列表中移除选中的语言
        updatedLanguages.splice(defaultIndex, 1);

        // 将默认语言插入到列表首位
        updatedLanguages.unshift(targetLanguage);

        // 触发更新事件
        emit('update:languages', updatedLanguages);
        emit('change', updatedLanguages);

        // 选中第一个位置（默认语言）
        emit('select', updatedLanguages[0], 0);
    }

    logger.info('设置默认语言:', targetLanguage.name, `(${targetLanguage.code})`);
};

// 检查一个语言是否默认语言
const isDefaultLanguage = (item: LanguageInfo | undefined) => {
    if (!item) return false;
    return item.code === props.defaultLanguage;
};
</script>

<template>
    <div class="language-manager">
        <!-- 语言列表 -->
        <UiList header="支持的语言" :items="languages" :selectedIndex="selectedIndex" :editable="true" direction="horizontal"
            @select="handleSelectLanguage" @add="openAddLanguageModal" @remove="handleRemoveLanguage">
            <template #header-actions>
                <ui-button
                    v-if="selectedIndex >= 0 && selectedIndex < languages.length && !isDefaultLanguage(languages[selectedIndex])"
                    @click.stop="setAsDefaultLanguage(selectedIndex)">
                    设为默认
                </ui-button>
            </template>

            <template #item="{ item }">
                <div class="language-item">
                    <ui-label :tooltip="item.name" :class="{ 'default-language': isDefaultLanguage(item) }">
                        {{ item.code }}
                    </ui-label>
                </div>
            </template>
        </UiList>

        <!-- 添加语言模态窗口 -->
        <UiModal v-model:visible="showAddLanguageModal" title="添加语言" okText="确认" cancelText="取消"
            @ok="confirmAddLanguage">
            <div class="language-form">
                <ui-prop>
                    <ui-label slot="label">语言名称</ui-label>
                    <ui-input slot="content" v-model="newLanguageName" placeholder="例如：繁體中文"></ui-input>
                </ui-prop>

                <ui-prop>
                    <ui-label slot="label">语言代码</ui-label>
                    <ui-input slot="content" v-model="newLanguageCode" placeholder="例如：zh-tw"></ui-input>
                </ui-prop>
            </div>
        </UiModal>
    </div>
</template>

<style scoped>
.language-manager {
    width: 100%;
}

.language-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.language-form ui-prop {
    margin-bottom: 0;
}

.language-item {
    padding: 2px 16px;
}

.set-default-btn {
    font-size: 12px;
    padding: 2px 8px;
}

.default-language {
    font-weight: bold;
    color: var(--highlight-color, #0078d4);
}
</style>