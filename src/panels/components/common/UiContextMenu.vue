<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

interface MenuItem {
    /**
     * 菜单项标识
     */
    key: string;
    /**
     * 显示文本
     */
    label: string;
    /**
     * 图标
     */
    icon?: string;
    /**
     * 是否禁用
     */
    disabled?: boolean;
    /**
     * 是否显示分割线
     */
    divider?: boolean;
}

interface Props {
    /**
     * 菜单项列表
     */
    items: MenuItem[];
    /**
     * 是否显示菜单
     */
    visible?: boolean;
    /**
     * 触发方式
     */
    trigger?: 'click' | 'hover';
    /**
     * 菜单位置
     */
    placement?: 'bottom' | 'bottom-start' | 'bottom-end' | 'top' | 'top-start' | 'top-end';
}

const props = withDefaults(defineProps<Props>(), {
    visible: false,
    trigger: 'click',
    placement: 'bottom-start'
});

const emit = defineEmits<{
    /**
     * 菜单项点击事件
     */
    (e: 'select', key: string): void;
    /**
     * 菜单显示状态变化
     */
    (e: 'update:visible', visible: boolean): void;
}>();

// 菜单容器引用
const menuRef = ref<HTMLElement>();
const triggerRef = ref<HTMLElement>();

// 菜单是否显示
const isVisible = ref(props.visible);

// 监听visible属性变化
watch(() => props.visible, (val) => {
    isVisible.value = val;
});

// 菜单样式类
const menuClasses = computed(() => {
    return {
        'ui-context-menu': true,
        'ui-context-menu-visible': isVisible.value,
        [`ui-context-menu-${props.placement}`]: true
    };
});

// 显示菜单
const showMenu = () => {
    isVisible.value = true;
    emit('update:visible', true);
};

// 隐藏菜单
const hideMenu = () => {
    isVisible.value = false;
    emit('update:visible', false);
};

// 切换菜单显示状态
const toggleMenu = () => {
    if (isVisible.value) {
        hideMenu();
    } else {
        showMenu();
    }
};

// 处理触发器点击
const handleTriggerClick = (event: Event) => {
    if (props.trigger === 'click') {
        event.preventDefault();
        event.stopPropagation();
        toggleMenu();
    }
};

// 处理触发器鼠标悬停
const handleTriggerMouseEnter = () => {
    if (props.trigger === 'hover') {
        showMenu();
    }
};

// 处理触发器鼠标离开
const handleTriggerMouseLeave = () => {
    if (props.trigger === 'hover') {
        // 延迟隐藏，给用户时间移动到菜单上
        setTimeout(() => {
            if (!menuRef.value?.matches(':hover')) {
                hideMenu();
            }
        }, 100);
    }
};

// 处理菜单项点击
const handleMenuItemClick = (item: MenuItem) => {
    if (item.disabled) return;

    emit('select', item.key);
    hideMenu();
};

// 处理点击外部区域
const handleClickOutside = (event: MouseEvent) => {
    if (!isVisible.value) return;

    const target = event.target as Node;
    const triggerElement = triggerRef.value;
    const menuElement = menuRef.value;

    // 如果点击的是触发器或菜单内部，不关闭
    if (triggerElement?.contains(target) || menuElement?.contains(target)) {
        return;
    }

    hideMenu();
};

// 处理键盘事件
const handleKeyDown = (event: KeyboardEvent) => {
    if (!isVisible.value) return;

    if (event.key === 'Escape') {
        event.preventDefault();
        hideMenu();
    }
};

// 组件挂载时添加事件监听
onMounted(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
});

// 组件卸载时移除事件监听
onBeforeUnmount(() => {
    document.removeEventListener('click', handleClickOutside);
    document.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
    <div class="ui-context-menu-container">
        <!-- 触发器插槽 -->
        <div ref="triggerRef" class="ui-context-menu-trigger" @click.stop="handleTriggerClick"
            @mouseenter="handleTriggerMouseEnter" @mouseleave="handleTriggerMouseLeave">
            <slot name="trigger"></slot>
        </div>

        <!-- 菜单内容 -->
        <div ref="menuRef" :class="menuClasses" @mouseleave="props.trigger === 'hover' && hideMenu()">
            <div v-for="item in items" :key="item.key" :class="{
                'ui-context-menu-item': true,
                'disabled': item.disabled,
                'divider': item.divider
            }" @click="handleMenuItemClick(item)">
                <ui-icon v-if="item.icon" :value="item.icon" class="menu-item-icon"></ui-icon>
                <span class="menu-item-label">{{ item.label }}</span>
            </div>
        </div>
    </div>
</template>

<style scoped>
.ui-context-menu-container {
    position: relative;
    display: inline-block;
}

.ui-context-menu-trigger {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
}

/* 确保按钮内的图标和文本垂直居中对齐 */
.ui-context-menu-trigger ui-button {
    display: flex !important;
    align-items: center !important;
}

.ui-context-menu {
    position: absolute;
    background-color: var(--menu-background, #2a2a2a);
    border: 1px solid var(--border-color, rgba(127, 127, 127, 0.3));
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    z-index: 9999;
    min-width: 120px;
    padding: 4px 0;
    opacity: 0;
    visibility: hidden;
    transform: translateY(-4px);
    transition: all 0.15s ease-out;
    outline: none;
    pointer-events: none;
}

.ui-context-menu-visible {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
    pointer-events: auto;
}

/* 位置样式 */
.ui-context-menu-bottom,
.ui-context-menu-bottom-start {
    top: 100%;
    left: 0;
    margin-top: 4px;
}

.ui-context-menu-bottom-end {
    top: 100%;
    right: 0;
    margin-top: 4px;
}

.ui-context-menu-top,
.ui-context-menu-top-start {
    bottom: 100%;
    left: 0;
    margin-bottom: 4px;
}

.ui-context-menu-top-end {
    bottom: 100%;
    right: 0;
    margin-bottom: 4px;
}

.ui-context-menu-item {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    cursor: pointer;
    color: var(--menu-text-color, rgba(255, 255, 255, 0.9));
    font-size: 12px;
    line-height: 1.4;
    transition: background-color 0.15s;
    outline: none;
}

.ui-context-menu-item:hover,
.ui-context-menu-item:focus {
    background-color: var(--menu-item-hover, rgba(70, 70, 70, 0.6));
}

.ui-context-menu-item.disabled {
    color: var(--menu-text-disabled, rgba(255, 255, 255, 0.4));
    cursor: not-allowed;
}

.ui-context-menu-item.disabled:hover,
.ui-context-menu-item.disabled:focus {
    background-color: transparent;
}

.ui-context-menu-item.divider {
    border-bottom: 1px solid var(--border-color, rgba(127, 127, 127, 0.2));
    margin-bottom: 4px;
    padding-bottom: 10px;
}

.menu-item-icon {
    margin-right: 8px;
    font-size: 12px;
    width: 12px;
    height: 12px;
    flex-shrink: 0;
}

.menu-item-label {
    flex: 1;
    white-space: nowrap;
}
</style>
