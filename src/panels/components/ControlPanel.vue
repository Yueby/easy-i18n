<script setup lang="ts">
import { defineEmits, defineProps, onBeforeUnmount, onMounted } from 'vue';
import { file } from '../../utils/file';
import { logger } from '../../utils/logger';

interface Props {
    /**
     * 导出路径
     */
    exportPath: string;
}

// 定义组件属性
const props = defineProps<Props>();

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
    /**
     * 路径变更完成时触发，用于通知父组件执行后续操作
     */
    (e: 'pathChanged', oldPath: string, newPath: string): void;
}>();

/**
 * 移动资源文件到新路径
 * @param oldPath 旧路径
 * @param newPath 新路径
 */
const moveAssetFiles = async (oldPath: string, newPath: string) => {
    try {
        if (!oldPath || oldPath === newPath) {
            logger.log('无需移动文件，路径相同');
            return;
        }

        logger.log('开始移动资源文件...');
        logger.log('旧路径:', oldPath);
        logger.log('新路径:', newPath);

        // 转换为db://格式用于API调用
        const oldUrl = oldPath.replace('project://', 'db://');
        const newUrl = newPath.replace('project://', 'db://');

        // 构建完整的文件URL
        const oldFileUrl = `${oldUrl}/i18n-data.json`;
        const newFileUrl = `${newUrl}/i18n-data.json`;

        logger.log('旧文件URL:', oldFileUrl);
        logger.log('新文件URL:', newFileUrl);

        // 检查旧文件是否存在
        const oldFileInfo = await file.queryAssetInfo(oldFileUrl);
        if (!oldFileInfo) {
            logger.log('旧文件不存在，无需移动');
            return;
        }

        // 移动JSON文件（编辑器会自动处理meta文件）
        logger.log('移动JSON文件...');
        const moveResult = await file.moveAsset(oldFileUrl, newFileUrl);
        
        if (moveResult) {
            logger.log('JSON文件移动成功');
            
            // 刷新资源数据库
            try {
                await file.refreshAsset(newUrl);
                logger.log('已刷新新路径的资源数据库');
            } catch (refreshError) {
                logger.warn('刷新资源数据库失败:', refreshError);
            }

        } else {
            logger.error('JSON文件移动失败');
            throw new Error('文件移动失败');
        }

        logger.log('资源文件移动完成');
        
    } catch (error) {
        logger.error('移动资源文件时出错:', error);
        throw error;
    }
};

/**
 * 将任意路径格式转换为project://格式
 * @param inputPath 输入的路径（可能是file://、db://、project://或其他格式）
 * @returns project://格式的路径
 */
const convertToProjectPath = (inputPath: string): string => {
    try {
        if (inputPath.startsWith('project://')) {
            return inputPath; // 已经是project协议
        }
        
        if (inputPath.startsWith('file://')) {
            // 移除file://前缀，获取实际路径
            const filePath = inputPath.replace('file://', '');
            const projectUrl = file.pathToAssetDbUrl(filePath);
            
            if (projectUrl && projectUrl.startsWith('db://')) {
                return projectUrl.replace('db://', 'project://');
            }
        }
        
        if (inputPath.startsWith('db://')) {
            return inputPath.replace('db://', 'project://');
        }
        
        // 其他格式，尝试转换
        const projectUrl = file.pathToAssetDbUrl(inputPath);
        if (projectUrl && projectUrl.startsWith('db://')) {
            return projectUrl.replace('db://', 'project://');
        }
        
        // 转换失败，返回默认路径
        return 'project://assets/resources/easy-i18n';
    } catch (error) {
        logger.error('路径转换失败:', error);
        return 'project://assets/resources/easy-i18n';
    }
};

// 处理目录变更
const handleDirectoryChange = async (path: string) => {
    if (!path) return;
    
    logger.log('收到路径变更:', path);
    
    // 保存旧路径用于移动文件
    const oldPath = props.exportPath;
    
    // 使用辅助函数转换路径
    const projectPath = convertToProjectPath(path);
    logger.log('转换后的project路径:', projectPath);
    
    // 如果路径确实发生了变化，执行移动操作
    if (oldPath && oldPath !== projectPath) {
        try {
            logger.log('检测到路径变更，开始移动资源文件...');
            await moveAssetFiles(oldPath, projectPath);
            logger.log('资源文件移动完成');
        } catch (error) {
            logger.error('移动资源文件失败:', error);
            // 即使移动失败，也继续更新路径，但记录错误
        }
    }
    
    // 更新路径
    emit('update:exportPath', projectPath);
    
    // 通知父组件路径变更完成
    if (oldPath && oldPath !== projectPath) {
        emit('pathChanged', oldPath, projectPath);
    }
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