<script setup lang="ts">
import { defineEmits, defineProps } from 'vue';

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
     * 用户点击保存按钮时触发
     */
    (e: 'save'): void;
}>();

// 处理目录变更
const handleDirectoryChange = (path: string) => {
    if (!path) return;
    emit('update:exportPath', path);
};

// 处理保存按钮点击
const handleSave = () => {
    emit('save');
};

// 处理转移按钮点击
const handleTransfer = () => {
    // emit('transfer');
};
</script>

<template>
    <div class="control-panel">
        <ui-prop>
            <ui-label slot="label">文件保存目录</ui-label>
            <ui-file slot="content" type="directory" :value="exportPath" protocols="project" placeholder="选择文件导出目录"
                @change="handleDirectoryChange($event.target.value)">
            </ui-file>
        </ui-prop>

        <ui-prop>
            <ui-label slot="label">操作</ui-label>
            <ui-button slot="content" @click="handleSave" tooltip="保存文件">
                <ui-icon value="save"></ui-icon>
            </ui-button>
            <ui-button slot="content" @click="handleTransfer" tooltip="转移文件">
                <ui-icon value="collapse-right"></ui-icon>
            </ui-button>
        </ui-prop>
    </div>
</template>

<style scoped>
.control-panel {
    margin-bottom: 4px;

}
</style>