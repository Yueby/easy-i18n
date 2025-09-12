<script setup lang="ts">
import { computed, defineEmits, defineProps } from 'vue';
import type { I18nBaseOptions, I18nItem, I18nItemValue, I18nTextOptions } from '../../types/i18n';
import { file } from '../../utils/file';
import { logger } from '../../utils/logger';
import UiSection from './common/UiSection.vue';

interface Props {
    /**
     * 翻译键名
     */
    keyName: string;

    /**
     * 翻译项
     */
    item: I18nItem;

    /**
     * 当前语言代码
     */
    languageCode: string;

    /**
     * 当前语言名称
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

    /**
     * 选项更新时触发
     */
    (e: 'optionsChange', options: any): void;
}>();

const langValue = computed<I18nItemValue>(() => 
    props.item?.value?.[props.languageCode] || { text: '', options: {} }
);

const text = computed({
    get() {
        const rawText = langValue.value.text || '';
        if (props.item?.type === 'sprite' && !validateSpriteText(rawText)) {
            setTimeout(() => emit('textChange', ''), 0);
            return '';
        }
        return rawText;
    },
    set(value: string) {
        emit('textChange', value);
    }
});

const getTranslationText = () => langValue.value.text || '';

const getSpriteFrameUuid = () => {
    const text = langValue.value.text || '';
    return text.includes(':') ? text.split(':')[1] : text;
};

const validateSpriteText = (text: string): boolean => {
    if (!text) return true;
    const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}(@[0-9a-f]+)?$/i;
    
    if (text.includes(':')) {
        const parts = text.split(':');
        return parts.length === 2 && uuidRegex.test(parts[0]) && uuidRegex.test(parts[1]);
    }
    
    return uuidRegex.test(text);
};

const getAtlasUuid = () => {
    const text = langValue.value.text || '';
    return text.includes(':') ? text.split(':')[0] : '';
};

const handleCompositionEnd = (event: any) => emit('textChange', event.target.value);

const handleSpriteChange = async (event: any) => {
    try {
        if (!event.target.value) {
            emit('textChange', '');
            emit('spriteChange', '');
            return;
        }

        const assetInfo = await file.queryAssetInfo(event.target.value);
        const spriteFrameUuid = assetInfo.uuid;
        let atlasUuid = '';

        if (assetInfo.url) {
            const atlasUrl = assetInfo.url.replace('/' + assetInfo.name, '');
            try {
                const atlasInfo = await file.queryAssetInfo(atlasUrl);
                if (atlasInfo?.type === "cc.SpriteAtlas") {
                    atlasUuid = atlasInfo.uuid;
                }
            } catch (error) {
                logger.warn('获取图集信息失败:', error);
            }
        }

        const translationText = atlasUuid ? `${atlasUuid}:${spriteFrameUuid}` : spriteFrameUuid;
        emit('textChange', translationText);
        emit('spriteChange', spriteFrameUuid);
    } catch (error) {
        logger.error('处理图片变更失败:', error);
    }
};

const getBaseOption = (key: keyof I18nBaseOptions): any => langValue.value.options?.[key];

const updateBaseOption = (key: keyof I18nBaseOptions, value: any) => {
    emit('optionsChange', { ...langValue.value.options, [key]: value });
};

const getTextOption = (key: keyof I18nTextOptions): any => langValue.value.options?.[key];

const updateTextOption = (key: keyof I18nTextOptions, value: any) => {
    emit('optionsChange', { ...langValue.value.options, [key]: value });
};

const updateContentSize = (dimension: 'width' | 'height', value: number) => {
    const currentSize = langValue.value.options?.contentSize || { width: 0, height: 0 };
    emit('optionsChange', {
        ...langValue.value.options,
        contentSize: {
            width: dimension === 'width' ? value : (currentSize.width || 0),
            height: dimension === 'height' ? value : (currentSize.height || 0)
        }
    });
};

const updateAnchorPoint = (dimension: 'x' | 'y', value: number) => {
    const currentAnchor = langValue.value.options?.anchorPoint || { x: 0, y: 0 };
    emit('optionsChange', {
        ...langValue.value.options,
        anchorPoint: {
            x: dimension === 'x' ? value : (currentAnchor.x || 0),
            y: dimension === 'y' ? value : (currentAnchor.y || 0)
        }
    });
};

const resetOptions = () => emit('optionsChange', {});
</script>

<template>
    <div class="translation-item">
        <!-- 翻译内容编辑区 -->
        <div class="translation-content">

            <!-- 常规文本模式 -->
            <template v-if="item && item.type !== 'sprite'">
                <ui-prop>
                    <ui-label slot="label">翻译文本</ui-label>
                    <ui-textarea slot="content" v-model="text" :placeholder="`输入${languageName}翻译`"
                        @compositionend="handleCompositionEnd" :title="getTranslationText()"></ui-textarea>
                </ui-prop>
            </template>

            <!-- 图片模式特有部分 - 左右两栏布局 -->
            <template v-if="item && item.type === 'sprite'">
                <div class="sprite-layout">
                    <!-- 左侧图片预览 -->
                    <div class="sprite-preview">
                        <ui-image :value="getSpriteFrameUuid()" style="width:60px;height:60px;"></ui-image>
                    </div>

                    <!-- 右侧翻译和资源选择区 -->
                    <div class="sprite-editor">
                        <!-- 上部分翻译框 -->
                        <ui-prop>
                            <ui-label slot="label">翻译ID</ui-label>
                            <ui-input slot="content" :value="getTranslationText()" readonly
                                :placeholder="`精灵图片uuid`"></ui-input>
                        </ui-prop>

                        <!-- 下部分图片资源拖拽框 -->
                        <ui-prop>
                            <ui-label slot="label">精灵图片</ui-label>
                            <ui-asset slot="content" droppable="cc.SpriteFrame" placeholder="拖入精灵帧资源"
                                :value="getSpriteFrameUuid()" @change="handleSpriteChange"
                                @compositionend="handleCompositionEnd"></ui-asset>
                        </ui-prop>

                        <!-- 图集资源显示框 -->
                        <ui-prop v-if="getAtlasUuid()">
                            <ui-label slot="label">所属图集</ui-label>
                            <ui-asset slot="content" droppable="cc.SpriteAtlas" readonly :value="getAtlasUuid()"
                                placeholder="图片所属图集"></ui-asset>
                        </ui-prop>
                    </div>
                </div>
            </template>

            <!-- 选项设置区 -->
            <UiSection header="选项设置">
                <template #header-actions>
                    <ui-button @click="resetOptions" tooltip="重置所有选项" class="reset-options-btn">
                        <ui-icon value="reset"></ui-icon>
                    </ui-button>
                </template>

                <!-- 基础选项 -->
                <div class="section-item">
                    <!-- Width -->
                    <ui-prop>
                        <ui-label slot="label">Content Size</ui-label>
                        <ui-num-input slot="content" style="width: 80px;"
                            :value="getBaseOption('contentSize')?.width || 0"
                            @change="updateContentSize('width', $event.target.value)"></ui-num-input>

                        <ui-num-input slot="content" style="width: 80px;"
                            :value="getBaseOption('contentSize')?.height || 0"
                            @change="updateContentSize('height', $event.target.value)"></ui-num-input>
                    </ui-prop>
                </div>

                <div class="section-item">
                    <ui-prop>
                        <ui-label slot="label">Anchor Point</ui-label>
                        <ui-num-input slot="content" style="width: 80px;" :value="getBaseOption('anchorPoint')?.x || 0"
                            @change="updateAnchorPoint('x', $event.target.value)"></ui-num-input>

                        <ui-num-input slot="content" style="width: 80px;" :value="getBaseOption('anchorPoint')?.y || 0"
                            @change="updateAnchorPoint('y', $event.target.value)"></ui-num-input>
                    </ui-prop>
                </div>

                <div class="section-item">
                    <ui-prop>
                        <ui-label slot="label">Color</ui-label>
                        <ui-color slot="content" :value="getBaseOption('color')"
                            @change="updateBaseOption('color', $event.target.value)"></ui-color>
                    </ui-prop>
                </div>

                <!-- 文本类型特有选项 -->
                <template v-if="item && item.type === 'text'">
                    <div class="section-item">
                        <ui-prop>
                            <ui-label slot="label">Font Size</ui-label>
                            <ui-num-input slot="content" :value="getTextOption('fontSize')"
                                @change="updateTextOption('fontSize', $event.target.value)"></ui-num-input>
                        </ui-prop>

                        <ui-prop>
                            <ui-label slot="label">Line Height</ui-label>
                            <ui-num-input slot="content" :value="getTextOption('lineHeight')"
                                @change="updateTextOption('lineHeight', $event.target.value)"></ui-num-input>
                        </ui-prop>
                    </div>

                </template>
            </UiSection>
        </div>
    </div>
</template>

<style scoped>
.translation-item {
    display: flex;
    flex-direction: column;
    width: 100%;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px dashed var(--border-color, rgba(127, 127, 127, 0.15));
}

.translation-item:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
}

.translation-content {
    display: flex;
    flex-direction: column;
}

.section-item {
    margin-left: 12px;
}

/* 子部分样式 */
.sub-section {
    margin-left: 4px;
    margin-top: 4px;
    margin-bottom: 2px;
    border-left: 1px solid var(--border-color, rgba(127, 127, 127, 0.2));
}

.sprite-layout {
    display: flex;
}

.sprite-preview {
    margin-right: 12px;
    border: 1px solid var(--border-color, rgba(127, 127, 127, 0.3));
    border-radius: 4px;
    padding: 4px;
    background-color: rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
}

.sprite-editor {
    flex: 1;
}

.invalid-text {
    display: none;
    /* 隐藏而不是完全删除，以便将来可能需要 */
}

/* 重置按钮样式 */
.reset-options-btn {
    min-width: auto;
    padding: 2px 4px;
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.reset-options-btn ui-icon {
    font-size: 10px;
}
</style>