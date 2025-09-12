<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
    /**
     * 标题文本
     */
    header?: string;

    /**
     * 是否默认展开
     */
    expand?: boolean;

    /**
     * 是否可折叠
     * 为false时始终展开，且不显示展开/折叠图标
     */
    collapsible?: boolean;

    /**
     * 禁用状态
     */
    disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    header: '',
    expand: true,
    collapsible: true,
    disabled: false
});

const emit = defineEmits<{
    /**
     * 展开状态变化
     */
    (e: 'toggle', expanded: boolean): void;
}>();

// 是否展开
const isExpanded = ref(props.expand);

// 监听expand属性变化
watch(() => props.expand, (val) => {
    isExpanded.value = val;
});

// 切换展开状态
const toggleExpand = () => {
    if (props.disabled || !props.collapsible) return;

    const newExpanded = !isExpanded.value;
    isExpanded.value = newExpanded;
    emit('toggle', newExpanded);
};
</script>

<template>
    <div class="ui-section" :class="{
        'ui-section-disabled': disabled,
        'ui-section-expanded': isExpanded || !collapsible,
        'ui-section-collapsible': collapsible
    }">
        <!-- 简洁标题栏 -->
        <div v-if="header" class="ui-section-header" :class="{
            'ui-section-header-clickable': collapsible && !disabled
        }" @click="toggleExpand">
            <div class="ui-section-header-left">
                <svg v-if="collapsible" class="ui-section-icon" viewBox="0 0 16 16" fill="currentColor">
                    <path v-if="isExpanded" d="M8 10.5L4 6.5h8L8 10.5z" />
                    <path v-else d="M6 4l4 4-4 4V4z" />
                </svg>
                <ui-label class="ui-section-title">{{ header }}</ui-label>
            </div>
            <div class="ui-section-header-actions" @click.stop>
                <!-- 标题栏右侧操作插槽 -->
                <slot name="header-actions"></slot>
            </div>
        </div>

        <!-- 内容区域 -->
        <div v-if="isExpanded || !collapsible" class="ui-section-content">
            <slot></slot>
        </div>
    </div>
</template>

<style scoped>
.ui-section {
    border: 1px solid var(--border-color, rgba(127, 127, 127, 0.2));
    border-radius: 4px;
    background-color: var(--section-background, transparent);
    margin-bottom: 2px;
    overflow: hidden;
    transition: all 0.2s ease-in-out;
    color: var(--section-text-color, inherit);
}

.ui-section-disabled {
    opacity: 0.6;
    pointer-events: none;
}

/* 简洁标题栏样式 */
.ui-section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2px 6px;
    background-color: var(--section-header-background, rgba(50, 50, 50, 0.1));
    border-bottom: 1px solid var(--border-color, rgba(127, 127, 127, 0.1));
    min-height: 14px;
    user-select: none;
}

.ui-section-header-clickable {
    cursor: pointer;
}

.ui-section-header-clickable:hover {
    background-color: var(--section-header-hover, rgba(70, 70, 70, 0.2));
}

.ui-section-header-left {
    display: flex;
    align-items: center;
    min-width: 0;
    flex: 1;
}

.ui-section-icon {
    margin-right: 4px;
    opacity: 0.7;
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    transition: transform 0.2s ease;
}

.ui-section-title {
    font-size: 12px;
    font-weight: normal;
    color: var(--section-title-color, inherit);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ui-section-header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    flex-shrink: 0;
}

/* 内容区域 */
.ui-section-content {
    padding: 4px 8px;
}

/* 如果没有标题，移除内容区域的上边距 */
.ui-section:not(:has(.ui-section-header)) .ui-section-content {
    padding-top: 8px;
}
</style>
