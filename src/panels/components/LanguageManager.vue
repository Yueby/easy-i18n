<script setup lang="ts">
import { ref } from 'vue';
import type { LanguageInfo } from '../../types/i18n';
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

    /**
     * 触发保存功能
     */
    (e: 'save'): void;
}>();

// 模态窗口控制
const showAddLanguageModal = ref(false);
const newLanguageName = ref('');
const newLanguageCode = ref('');

// 改名模态窗口控制
const showRenameLanguageModal = ref(false);
const editingLanguageIndex = ref(-1);
const editLanguageName = ref('');
const editLanguageCode = ref('');

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

const confirmAddLanguage = () => {
    if (!newLanguageCode.value) return;

    const newLanguage = {
        name: newLanguageName.value || newLanguageCode.value,
        code: newLanguageCode.value
    };

    const updatedLanguages = [...props.languages, newLanguage];
    emit('update:languages', updatedLanguages);
    emit('change', updatedLanguages);

    if (props.languages.length === 0) {
        emit('select', newLanguage, 0);
        emit('update:defaultLanguage', newLanguage.code);
    }

    showAddLanguageModal.value = false;
    emit('save');
};

const handleRemoveLanguage = (item: LanguageInfo, index: number) => {
    const isDefault = isDefaultLanguage(item);
    const updatedLanguages = [...props.languages];
    updatedLanguages.splice(index, 1);

    emit('update:languages', updatedLanguages);
    emit('change', updatedLanguages);

    if (index === props.selectedIndex && updatedLanguages.length > 0) {
        emit('select', updatedLanguages[0], 0);
    }

    if (isDefault) {
        emit('update:defaultLanguage', updatedLanguages.length > 0 ? updatedLanguages[0].code : '');
    }

    emit('save');
};

// 打开语言改名模态窗口
const openRenameLanguageModal = (index: number) => {
    if (index < 0 || index >= props.languages.length) return;

    const language = props.languages[index];
    editingLanguageIndex.value = index;
    editLanguageName.value = language.name;
    editLanguageCode.value = language.code;
    showRenameLanguageModal.value = true;
};

const confirmRenameLanguage = () => {
    if (editingLanguageIndex.value < 0 || !editLanguageCode.value) return;

    const updatedLanguages = [...props.languages];
    const oldLanguage = updatedLanguages[editingLanguageIndex.value];
    const isDefault = isDefaultLanguage(oldLanguage);

    updatedLanguages[editingLanguageIndex.value] = {
        name: editLanguageName.value || editLanguageCode.value,
        code: editLanguageCode.value
    };

    if (isDefault) {
        emit('update:defaultLanguage', editLanguageCode.value);
    }

    emit('update:languages', updatedLanguages);
    emit('change', updatedLanguages);

    showRenameLanguageModal.value = false;
    editingLanguageIndex.value = -1;
    emit('save');
};

const setAsDefaultLanguage = (index: number) => {
    if (index < 0 || index >= props.languages.length) return;

    const targetLanguage = props.languages[index];
    emit('update:defaultLanguage', targetLanguage.code);

    const defaultIndex = props.languages.findIndex(lang => lang.code === targetLanguage.code);
    if (defaultIndex > 0) {
        const updatedLanguages = [...props.languages];
        updatedLanguages.splice(defaultIndex, 1);
        updatedLanguages.unshift(targetLanguage);

        emit('update:languages', updatedLanguages);
        emit('change', updatedLanguages);
        emit('select', updatedLanguages[0], 0);
    }

    Editor.Message.send("playable-ads-adapter", "update-language", targetLanguage.code);
    emit('save');
};

const isDefaultLanguage = (item: LanguageInfo | undefined) => item?.code === props.defaultLanguage;
</script>

<template>
    <div class="language-manager">
        <!-- 语言列表 -->
        <UiList header="支持的语言" :items="languages" :selectedIndex="selectedIndex" :editable="true" direction="horizontal"
            :wrap="true" @select="handleSelectLanguage" @add="openAddLanguageModal" @remove="handleRemoveLanguage">
            <template #header-actions>
                <ui-button
                    v-if="selectedIndex >= 0 && selectedIndex < languages.length && !isDefaultLanguage(languages[selectedIndex])"
                    @click.stop="setAsDefaultLanguage(selectedIndex)">
                    设为默认
                </ui-button>
                <ui-button v-if="selectedIndex >= 0 && selectedIndex < languages.length"
                    @click.stop="openRenameLanguageModal(selectedIndex)">
                    <ui-icon value="edit"></ui-icon>
                </ui-button>
            </template>

            <template #item="{ item }">
                <div class="language-item">
                    <ui-label :tooltip="item.name">
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
                    <ui-label slot="label">语言代码 <span class="required">*</span></ui-label>
                    <ui-input slot="content" v-model="newLanguageCode" placeholder="例如：zh-tw"
                        @compositionend="() => { }"></ui-input>
                </ui-prop>

                <ui-prop>
                    <ui-label slot="label">语言名称 <span class="optional">(可选)</span></ui-label>
                    <ui-input slot="content" v-model="newLanguageName" placeholder="例如：繁體中文"
                        @compositionend="() => { }"></ui-input>
                </ui-prop>
            </div>
        </UiModal>

        <!-- 改名语言模态窗口 -->
        <UiModal v-model:visible="showRenameLanguageModal" title="修改语言" okText="确认" cancelText="取消"
            @ok="confirmRenameLanguage">
            <div class="language-form">
                <ui-prop>
                    <ui-label slot="label">语言代码 <span class="required">*</span></ui-label>
                    <ui-input slot="content" v-model="editLanguageCode" placeholder="例如：zh-tw"
                        @compositionend="() => { }"></ui-input>
                </ui-prop>

                <ui-prop>
                    <ui-label slot="label">语言名称 <span class="optional">(可选)</span></ui-label>
                    <ui-input slot="content" v-model="editLanguageName" placeholder="例如：繁體中文"
                        @compositionend="() => { }"></ui-input>
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
    gap: 4px;
}

.language-form ui-prop {
    margin-bottom: 0;
}

.language-item {
    padding: 2px 16px;
    position: relative;
    display: flex;
    align-items: center;
}

.set-default-btn {
    font-size: 12px;
    padding: 2px 8px;
}

.required {
    color: #e88080;
}

.optional {
    color: #aaa;
    font-size: 12px;
}
</style>