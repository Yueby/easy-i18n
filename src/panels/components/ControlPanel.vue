<script setup lang="ts">
import { defineEmits, defineProps, onBeforeUnmount, onMounted } from 'vue';

interface Props {
    /**
     * 导出路径
     */
    exportPath: string;
}

// 定义组件属性
defineProps<Props>();

// 定义事件
const emit = defineEmits<{
    /**
     * 导出路径变更时触发
     */
    (e: 'update:exportPath', path: string): void;
    /**
     * 用户按下Ctrl+S时触发
     */
    (e: 'save'): void;
}>();

// 处理目录变更
const handleDirectoryChange = (path: string) => {
    if (!path) return;
    emit('update:exportPath', path);
};

// 处理键盘事件，检测Ctrl+S
const handleKeyDown = (event: KeyboardEvent) => {
    // 检测Ctrl+S (Windows/Linux) 或 Command+S (Mac)
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        // 阻止默认的浏览器保存行为
        event.preventDefault();
        // 触发保存
        emit('save');
    }
};

// 在组件挂载后添加键盘事件监听
onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
});

// 在组件卸载前移除键盘事件监听
onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
    <div class="control-panel">
        <ui-prop>
            <ui-label slot="label">文件保存目录</ui-label>
            <ui-file slot="content" type="directory" :value="exportPath" protocols="project" placeholder="选择文件导出目录"
                @change="handleDirectoryChange($event.target.value)">
            </ui-file>
        </ui-prop>
    </div>
</template>

<style scoped>
.control-panel {
    margin-bottom: 4px;
}
</style>