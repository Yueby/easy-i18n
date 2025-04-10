<script setup lang="ts">
import { defineEmits, defineProps } from 'vue';
import type { I18nItem } from '../../types/i18n';

interface Props {
    /**
     * 翻译键
     */
    keyName: string;

    /**
     * 翻译项数据
     */
    item: I18nItem;

    /**
     * 语言代码
     */
    languageCode: string;

    /**
     * 语言名称
     */
    languageName: string;
}

// 定义组件属性
const props = defineProps<Props>();

// 定义事件
const emit = defineEmits<{
    /**
     * 文本翻译内容变更时触发
     */
    (e: 'textChange', value: string): void;

    /**
     * 图片资源变更时触发
     */
    (e: 'spriteChange', uuid: string): void;
}>();

// 处理文本变更
const handleTextChange = (event: any) => {
    emit('textChange', event.target.value);
};

// 处理图片变更
const handleSpriteChange = (event: any) => {
    emit('spriteChange', event.target.value);
};

// 获取当前语言的翻译文本
const getTranslationText = () => {
    return props.item.value[props.languageCode] || '';
};
</script>

<template>
    <div class="translation-item">
        <!-- 翻译内容编辑区 -->
        <div class="translation-content">
            <!-- 语言标签和翻译输入 (两种模式共有) -->
            <ui-prop>
                <ui-label slot="label">
                    {{ languageName }} ({{ languageCode }})
                </ui-label>
                <ui-input slot="content" :value="getTranslationText()" :placeholder="`输入${languageName}翻译`"
                    @input="handleTextChange"></ui-input>
            </ui-prop>

            <!-- 图片模式特有部分 -->
            <template v-if="item.type === 'sprite'">
                <ui-prop>
                    <ui-label slot="label">图片资源</ui-label>
                    <ui-asset slot="content" droppable="cc.ImageAsset" placeholder="拖入图片资源"
                        @change="handleSpriteChange"></ui-asset>
                </ui-prop>
                <ui-prop>
                    <ui-label slot="label">值类型</ui-label>
                    <ui-button slot="content">uuid</ui-button>
                    <ui-button slot="content">path</ui-button>
                </ui-prop>
            </template>
        </div>
    </div>
</template>

<style scoped>
.translation-item {
    display: flex;
    flex-direction: column;
    width: 100%;
}

.translation-content {
    display: flex;
    flex-direction: column;
}
</style>