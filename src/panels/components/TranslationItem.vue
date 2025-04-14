<script setup lang="ts">
import { computed, defineEmits, defineProps } from 'vue';
import type { I18nBaseOptions, I18nItem, I18nItemValue, I18nTextOptions } from '../../types/i18n';
import { file } from '../../utils/file';
import { logger } from '../../utils/logger';

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

// 获取当前语言的值对象
const langValue = computed<I18nItemValue>(() => {
    const value = props.item.value[props.languageCode];
    if (!value) {
        // 如果没有值，返回默认值对象
        return {
            text: '',
            options: {}
        };
    }
    return value;
});

// 翻译文本
const text = computed({
    get() {
        const rawText = props.item.value[props.languageCode]?.text || '';
        
        // 如果是图片类型且验证失败，返回空字符串
        if (props.item.type === 'sprite' && !validateSpriteText(rawText)) {
            // 通知父组件清空无效翻译
            setTimeout(() => emit('textChange', ''), 0);
            return '';
        }
        
        return rawText;
    },
    set(value: string) {
        emit('textChange', value);
    }
});

// 友好的精灵资源ID（用于显示）
const friendlyResourceId = computed(() => {
    const rawText = props.item.value[props.languageCode]?.text || '';

    // 如果是图片模式并且是组合格式（atlas:spriteFrame），则显示友好名称
    if (props.item.type === 'sprite' && rawText && rawText.includes(':')) {
        return "图集精灵资源"; // 可以根据需要修改这个显示文本
    }

    return rawText;
});

// 获取当前语言的翻译文本（返回原始存储的文本，当需要原始文本时使用）
const getTranslationText = () => {
    return langValue.value.text || '';
};

// 从翻译文本中获取精灵帧UUID
const getSpriteFrameUuid = () => {
    const text = langValue.value.text || '';
    
    // 如果是组合格式（atlas:spriteFrame），则提取spriteFrame部分
    if (text && text.includes(':')) {
        return text.split(':')[1]; // 返回spriteFrame的UUID部分
    }
    
    return text; // 如果不是组合格式，直接返回（可能是单独的spriteFrame UUID）
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

// 获取图集UUID（如果有的话）
const getAtlasUuid = () => {
    const text = langValue.value.text || '';

    // 如果是组合格式（atlas:spriteFrame），则提取atlas部分
    if (text && text.includes(':')) {
        return text.split(':')[0]; // 返回atlas的UUID部分
    }

    return ''; // 没有图集UUID
};

// 处理中文输入完成
const handleCompositionEnd = (event: any) => {
    // 确保中文输入完成后更新文本
    emit('textChange', event.target.value);
};

// 处理图片变更
const handleSpriteChange = async (event: any) => {
    try {
        // 如果值为空，则直接清空资源
        if (!event.target.value) {
            emit('textChange', '');
            emit('spriteChange', '');
            return;
        }

        const assetInfo = await file.queryAssetInfo(event.target.value);

        // 提取精灵帧UUID
        const spriteFrameUuid = assetInfo.uuid;
        let atlasUuid = '';

        // 检查url是否存在
        if (assetInfo.url) {
            const url = assetInfo.url;

            const atlasUrl = url.replace('/' + assetInfo.name, '');

            try {
                // 查询图集资源信息
                const atlasInfo = await file.queryAssetInfo(atlasUrl);
 
                if (atlasInfo && atlasInfo.type === "cc.SpriteAtlas") {
                    atlasUuid = atlasInfo.uuid;
                }
            } catch (error) {
                logger.warn('获取图集信息失败:', error);
            }
        }

        // 根据是否找到图集生成翻译文本
        let translationText = '';
        if (atlasUuid !== '') {
            translationText = `${atlasUuid}:${spriteFrameUuid}`;
        } else {
            // 没有找到图集，只使用精灵帧UUID
            translationText = spriteFrameUuid;
        }

        // 发送更新的翻译文本
        emit('textChange', translationText);
        emit('spriteChange', spriteFrameUuid);

    } catch (error) {
        logger.error('处理图片变更时出错:', error);
    }
};

// 获取基础选项值
const getBaseOption = (key: keyof I18nBaseOptions): any => {
    if (!langValue.value.options) return undefined;
    return langValue.value.options[key];
};

// 更新基础选项
const updateBaseOption = (key: keyof I18nBaseOptions, value: any) => {
    const currentOptions = langValue.value.options || {};
    emit('optionsChange', {
        ...currentOptions,
        [key]: value
    });
};

// 获取文本选项值
const getTextOption = (key: keyof I18nTextOptions): any => {
    if (!langValue.value.options) return undefined;
    return langValue.value.options[key];
};

// 更新文本选项
const updateTextOption = (key: keyof I18nTextOptions, value: any) => {
    const currentOptions = langValue.value.options || {};
    emit('optionsChange', {
        ...currentOptions,
        [key]: value
    });
};

// 更新内容大小
const updateContentSize = (dimension: 'width' | 'height', value: number) => {
    const currentOptions = langValue.value.options || {};
    const currentSize = currentOptions.contentSize || { width: 0, height: 0 };
    
    emit('optionsChange', {
        ...currentOptions,
        contentSize: {
            width: dimension === 'width' ? value : (currentSize.width || 0),
            height: dimension === 'height' ? value : (currentSize.height || 0)
        }
    });
};

// 更新锚点
const updateAnchorPoint = (dimension: 'x' | 'y', value: number) => {
    const currentOptions = langValue.value.options || {};
    const currentAnchor = currentOptions.anchorPoint || { x: 0, y: 0 };
    
    emit('optionsChange', {
        ...currentOptions,
        anchorPoint: {
            x: dimension === 'x' ? value : (currentAnchor.x || 0),
            y: dimension === 'y' ? value : (currentAnchor.y || 0)
        }
    });
};
</script>

<template>
    <div class="translation-item">
        <!-- 翻译内容编辑区 -->
        <div class="translation-content">
            <!-- 语言标签显示在最上方 -->
            <div>
                <ui-label>{{ languageName }} ({{ languageCode }})</ui-label>
            </div>

            <!-- 常规文本模式 -->
            <template v-if="item.type !== 'sprite'">
                <ui-prop>
                    <ui-label slot="label">翻译文本</ui-label>
                    <ui-input slot="content" v-model="text" :placeholder="`输入${languageName}翻译`"
                        @compositionend="handleCompositionEnd" :title="getTranslationText()"></ui-input>
                </ui-prop>
            </template>

            <!-- 图片模式特有部分 - 左右两栏布局 -->
            <template v-if="item.type === 'sprite'">
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
                            <ui-input slot="content" :value="friendlyResourceId" readonly :placeholder="`精灵资源ID`"
                                tooltip="保存为 {SpriteAtlas Uuid}:{SpriteFrame Uuid}"></ui-input>

                        </ui-prop>

                        <!-- 下部分图片资源拖拽框 -->
                        <ui-prop>
                            <ui-label slot="label">图片资源</ui-label>
                            <ui-asset slot="content" droppable="cc.SpriteFrame" placeholder="拖入图片资源"
                                :value="getSpriteFrameUuid()" @change="handleSpriteChange"
                                @compositionend="handleCompositionEnd"></ui-asset>
                        </ui-prop>

                        <!-- 图集资源显示框 -->
                        <ui-prop v-if="getAtlasUuid()">
                            <ui-label slot="label">图集资源</ui-label>
                            <ui-asset slot="content" droppable="cc.SpriteAtlas" readonly :value="getAtlasUuid()"
                                placeholder="图片所属图集"></ui-asset>
                        </ui-prop>
                    </div>
                </div>
            </template>

            <!-- 选项设置区 -->
            <ui-section header="选项设置">
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
                <template v-if="item.type === 'text'">
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
            </ui-section>
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
    display: none;  /* 隐藏而不是完全删除，以便将来可能需要 */
}

.invalid-sprite {
    /* 移除无效样式 */
}
</style>