<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import UiHeader from './UiHeader.vue';

interface Props {
    /**
     * 是否显示模态窗口
     */
    visible?: boolean;

    /**
     * 模态窗口标题
     */
    title?: string;

    /**
     * 确认按钮文本
     */
    okText?: string;

    /**
     * 取消按钮文本
     */
    cancelText?: string;

    /**
     * 宽度
     */
    width?: string | number;

    /**
     * 是否显示关闭按钮
     */
    showClose?: boolean;

    /**
     * 点击遮罩是否关闭
     */
    closeOnClickMask?: boolean;

    /**
     * 按ESC键是否关闭
     */
    closeOnPressEscape?: boolean;

    /**
     * 按Enter键是否确认
     */
    confirmOnPressEnter?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
    visible: false,
    title: '',
    okText: '确定',
    cancelText: '取消',
    width: '480px',
    showClose: true,
    closeOnClickMask: true,
    closeOnPressEscape: true,
    confirmOnPressEnter: true
});

const emit = defineEmits<{
    /**
     * 更新可见状态
     */
    (e: 'update:visible', visible: boolean): void;

    /**
     * 确认回调
     */
    (e: 'ok'): void;

    /**
     * 取消回调
     */
    (e: 'cancel'): void;

    /**
     * 关闭回调
     */
    (e: 'close'): void;
}>();

// 模态窗口是否显示
const isVisible = ref(props.visible);

// 监听 visible 属性变化
watch(() => props.visible, (val) => {
    isVisible.value = val;
});

// 模态窗口样式
const modalStyle = ref({
    width: typeof props.width === 'number' ? `${props.width}px` : props.width
});

// 关闭模态窗口
const closeModal = () => {
    isVisible.value = false;
    emit('update:visible', false);
    emit('close');
};

// 确认
const handleOk = () => {
    emit('ok');
    closeModal();
};

// 取消
const handleCancel = () => {
    emit('cancel');
    closeModal();
};

// 点击遮罩
const handleMaskClick = () => {
    if (props.closeOnClickMask) {
        closeModal();
    }
};

// 处理键盘事件
const handleKeyDown = (event: KeyboardEvent) => {
    // 只有当模态窗口可见时才处理键盘事件
    if (!isVisible.value) return;
    
    if (event.key === 'Escape' && props.closeOnPressEscape) {
        event.preventDefault();
        handleCancel();
    } else if (event.key === 'Enter' && props.confirmOnPressEnter) {
        // 避免在input元素内按Enter键时也触发确认
        const activeElement = document.activeElement;
        const isTextArea = activeElement && activeElement.tagName === 'TEXTAREA';
        
        // 如果是多行文本框，不触发确认
        if (isTextArea) return;
        
        // 如果是单行输入框且正在输入，不触发确认
        if (activeElement && activeElement.tagName === 'INPUT' && 
            (activeElement as HTMLInputElement).type === 'text') {
            // 如果按下了修饰键（如组合键Ctrl+Enter等）才触发
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                handleOk();
            }
        } else {
            // 不是文本输入元素，直接触发确认
            event.preventDefault();
            handleOk();
        }
    }
};

// 组件挂载和卸载时添加/移除键盘事件监听
onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
});

onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
    <div v-if="isVisible" class="ui-modal-overlay ui-modal-dark" @click="handleMaskClick">
        <div class="ui-modal" :style="modalStyle" @click.stop>
            <!-- 使用UiHeader组件作为标题栏 -->
            <UiHeader
                :title="title"
                :collapsible="false"
            >
                <ui-button 
                    v-if="showClose" 
                    class="transparent" 
                    type="icon" 
                    @click="closeModal"
                >
                    <ui-icon value="close" color="danger"></ui-icon>
                </ui-button>
            </UiHeader>
            
            <!-- 内容 -->
            <div class="ui-modal-body">
                <slot></slot>
            </div>
            
            <!-- 底部按钮 -->
            <div class="ui-modal-footer">
                <slot name="footer">
                    <ui-button @click="handleCancel">
                        {{ cancelText }}
                    </ui-button>
                    <ui-button type="primary" @click="handleOk">
                        {{ okText }}
                    </ui-button>
                </slot>
            </div>
        </div>
    </div>
</template>

<style scoped>
.ui-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.ui-modal {
    background-color: var(--modal-background, #202020);
    border-radius: 4px;
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.23);
    display: flex;
    flex-direction: column;
    max-width: 90%;
    max-height: 80%;
    overflow: hidden;
}

.ui-modal-dark {
    color: var(--dark-text-color, rgba(255, 255, 255, 0.9));
}

.ui-modal-body {
    padding: 12px 16px;
    overflow-y: auto;
    min-height: 20px;
}

.ui-modal-footer {
    padding: 8px 16px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    border-top: 1px solid var(--border-color, rgba(127, 127, 127, 0.2));
}

.ui-modal-footer ui-button {
    min-width: 64px;
    padding: 0 12px;
}
</style>