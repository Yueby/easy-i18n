<script setup lang="ts">
import { computed } from 'vue';

interface Props {
    /**
     * 标题文本
     */
    title?: string;

    /**
     * 是否展开
     */
    expanded?: boolean;

    /**
     * 是否可折叠
     * 为false时不显示箭头图标
     */
    collapsible?: boolean;

    /**
     * 禁用状态
     */
    disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    title: '',
    expanded: true,
    collapsible: true,
    disabled: false
});

const emit = defineEmits<{
    /**
     * 展开状态变化
     */
    (e: 'toggle', expanded: boolean): void;
}>();

// 计算样式类
const headerClasses = computed(() => {
    return {
        'ui-header': true,
        'ui-header-dark': true,
        'ui-header-disabled': props.disabled,
        'ui-header-collapsible': props.collapsible
    };
});

// 处理点击事件
const handleClick = () => {
    if (props.disabled || !props.collapsible) return;
    emit('toggle', !props.expanded);
};
</script>

<template>
    <div :class="headerClasses" @click="handleClick">
        <div class="ui-header-left">
            <ui-icon v-if="collapsible" class="ui-header-icon" :value="expanded ? 'collapse' : 'expand'"></ui-icon>
            <ui-label v-if="title" class="ui-header-title">{{ title }}</ui-label>
        </div>
        <div class="ui-header-actions">
            <slot></slot>
        </div>
    </div>
</template>

<style scoped>
.ui-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 8px 6px;
    background-color: var(--header-background, rgba(50, 50, 50, 0.2));
    border-bottom: 1px solid var(--border-color, rgba(127, 127, 127, 0.2));
    user-select: none;
    box-sizing: border-box;
    overflow: hidden;

}

.ui-header-collapsible {
    cursor: pointer;
}

.ui-header-left {
    display: flex;
    align-items: center;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
}

.ui-header-icon {
    margin-right: 6px;
    opacity: 0.7;
    flex-shrink: 0;
}

.ui-header-title {
    font-weight: bold;
    font-size: 14px;
    color: var(--header-text-color, inherit);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.ui-header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    flex-shrink: 0;
    padding-right: 4px;
}

.ui-header-disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.ui-header-dark {
    color: var(--dark-text-color, rgba(255, 255, 255, 0.9));
}
</style>