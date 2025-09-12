<script setup lang="ts">
import fs from 'fs';
import Papa from 'papaparse';
import { defineEmits, defineProps, onBeforeUnmount, onMounted, ref } from 'vue';
import { file } from '../../utils/file';
import { logger } from '../../utils/logger';
import UiContextMenu from './common/UiContextMenu.vue';
import UiModal from './common/UiModal.vue';

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
    /**
     * CSV导入时触发
     */
    (e: 'importCsv', csvPath: string, selectedLanguages: string[]): void;
    /**
     * Options CSV导入时触发
     */
    (e: 'importOptionsCsv', csvPath: string, selectedLanguages: string[]): void;
    /**
     * CSV导出时触发
     */
    (e: 'exportCsv', csvPath: string): void;
    /**
     * Options CSV导出时触发
     */
    (e: 'exportOptionsCsv', csvPath: string): void;
}>();

// CSV默认目录路径
const csvDefaultDir = '\\\\10.0.0.135\\fzvideo2\\001-H5相关资源\\Cocos代码相关\\插件\\i18n\\data';

// 导出菜单是否显示
const exportMenuVisible = ref(false);

// 导出菜单项
const exportMenuItems = [
    {
        key: 'text',
        label: '导出翻译内容',
        icon: 'export'
    },
    {
        key: 'options',
        label: '导出显示配置',
        icon: 'export'
    }
];

// 导入菜单是否显示
const importMenuVisible = ref(false);

// 导入菜单项
const importMenuItems = [
    {
        key: 'text',
        label: '导入翻译内容',
        icon: 'import'
    },
    {
        key: 'options',
        label: '导入显示配置',
        icon: 'import'
    }
];

// 语言选择Modal相关状态
const showLanguageSelectModal = ref(false);
const pendingImportData = ref<{
    csvPath: string;
    csvLanguages: string[];
    importType: 'text' | 'options';
} | null>(null);
const selectedLanguages = ref<string[]>([]);

// 移动资源文件到新路径
const moveAssetFiles = async (oldPath: string, newPath: string) => {
    if (!oldPath || oldPath === newPath) return;

    try {
        // 转换为db://格式用于API调用
        const oldUrl = oldPath.replace('project://', 'db://');
        const newUrl = newPath.replace('project://', 'db://');
        const oldFileUrl = `${oldUrl}/i18n-data.json`;
        const newFileUrl = `${newUrl}/i18n-data.json`;

        // 检查旧文件是否存在
        const oldFileInfo = await file.queryAssetInfo(oldFileUrl);
        if (!oldFileInfo) return;

        // 移动JSON文件
        const moveResult = await file.moveAsset(oldFileUrl, newFileUrl);
        if (moveResult) {
            // 刷新资源数据库
            await file.refreshAsset(newUrl).catch(() => { });
        } else {
            throw new Error('文件移动失败');
        }
    } catch (error) {
        logger.error('移动资源文件失败:', error);
        throw error;
    }
};

// 将任意路径格式转换为project://格式
const convertToProjectPath = (inputPath: string): string => {
    try {
        // 已经是project协议
        if (inputPath.startsWith('project://')) return inputPath;

        // db://协议直接转换
        if (inputPath.startsWith('db://')) {
            return inputPath.replace('db://', 'project://');
        }

        // file://协议需要先转换为db://
        if (inputPath.startsWith('file://')) {
            const projectUrl = file.pathToAssetDbUrl(inputPath.replace('file://', ''));
            if (projectUrl?.startsWith('db://')) {
                return projectUrl.replace('db://', 'project://');
            }
        }

        // 其他格式尝试转换
        const projectUrl = file.pathToAssetDbUrl(inputPath);
        if (projectUrl?.startsWith('db://')) {
            return projectUrl.replace('db://', 'project://');
        }

        // 转换失败，返回默认路径
        return 'project://assets/resources/easy-i18n';
    } catch {
        return 'project://assets/resources/easy-i18n';
    }
};

// 处理目录变更
const handleDirectoryChange = async (path: string) => {
    if (!path) return;

    const oldPath = props.exportPath;
    const projectPath = convertToProjectPath(path);

    // 如果路径确实发生了变化，执行移动操作
    if (oldPath && oldPath !== projectPath) {
        try {
            await moveAssetFiles(oldPath, projectPath);
        } catch (error) {
            logger.error('移动资源文件失败:', error);
        }
        emit('pathChanged', oldPath, projectPath);
    }

    emit('update:exportPath', projectPath);
};

// 处理键盘事件，检测Ctrl+S
const handleKeyDown = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        emit('save');
    }
};

// 组件生命周期
onMounted(() => window.addEventListener('keydown', handleKeyDown));
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeyDown));

const handleImportCsv = async () => {
    try {
        const result = await Editor.Dialog.select({
            title: '选择翻译内容CSV文件',
            path: csvDefaultDir,
            type: 'file',
            filters: [{ name: 'CSV文件', extensions: ['csv'] }]
        });

        if (!result.canceled && result.filePaths?.[0]) {
            await parseAndShowLanguageSelect(result.filePaths[0], 'text');
        }
    } catch (error) {
        logger.error('文件选择失败:', error);
    }
};

const handleImportOptionsCsv = async () => {
    try {
        const result = await Editor.Dialog.select({
            title: '选择显示配置CSV文件',
            path: csvDefaultDir,
            type: 'file',
            filters: [{ name: 'CSV文件', extensions: ['csv'] }]
        });

        if (!result.canceled && result.filePaths?.[0]) {
            await parseAndShowLanguageSelect(result.filePaths[0], 'options');
        }
    } catch (error) {
        logger.error('文件选择失败:', error);
    }
};

const handleExportCsv = async () => {
    try {
        const result = await Editor.Dialog.save({
            title: '导出翻译内容CSV文件',
            path: csvDefaultDir,
            filters: [{ name: 'CSV文件', extensions: ['csv'] }]
        });

        if (!result.canceled && result.filePath) {
            emit('exportCsv', result.filePath);
        }
    } catch (error) {
        logger.error('保存对话框失败:', error);
    }
};

const handleExportOptionsCsv = async () => {
    try {
        const result = await Editor.Dialog.save({
            title: '导出显示配置CSV文件',
            path: csvDefaultDir,
            filters: [{ name: 'CSV文件', extensions: ['csv'] }]
        });

        if (!result.canceled && result.filePath) {
            emit('exportOptionsCsv', result.filePath);
        }
    } catch (error) {
        logger.error('保存对话框失败:', error);
    }
};

// 处理导入菜单选择
const handleImportMenuSelect = (key: string) => {
    if (key === 'text') {
        handleImportCsv();
    } else {
        handleImportOptionsCsv();
    }
};

// 处理导出菜单选择
const handleExportMenuSelect = (key: string) => {
    if (key === 'text') {
        handleExportCsv();
    } else {
        handleExportOptionsCsv();
    }
};

const handleCopyDirectory = async () => {
    try {
        await navigator.clipboard.writeText(csvDefaultDir);
    } catch (error) {
        logger.error('复制目录路径失败:', error);
    }
};

// 解析CSV并显示语言选择Modal
const parseAndShowLanguageSelect = async (csvPath: string, importType: 'text' | 'options') => {
    try {
        // 读取CSV文件内容
        const csvContent = fs.readFileSync(csvPath, 'utf-8');

        // 解析CSV内容
        const parseResult = Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
            transform: (value: string) => value.trim()
        });

        if (parseResult.errors.length > 0) {
            logger.error('CSV解析错误:', parseResult.errors);
            return;
        }

        const csvData = parseResult.data as any[];
        if (csvData.length === 0) {
            logger.warn('CSV文件为空');
            return;
        }

        // 提取语言列
        const firstRow = csvData[0];
        const csvLanguages = importType === 'text'
            ? Object.keys(firstRow).filter(key => key !== 'key' && key !== 'type')
            : Object.keys(firstRow).filter(key => key !== 'key');

        if (csvLanguages.length === 0) {
            logger.warn('CSV文件中没有找到语言列');
            return;
        }

        // 存储待导入数据并显示语言选择Modal
        pendingImportData.value = { csvPath, csvLanguages, importType };
        selectedLanguages.value = [...csvLanguages]; // 默认全选
        showLanguageSelectModal.value = true;
    } catch (error) {
        logger.error('CSV解析失败:', error);
    }
};

// 处理语言选择确认
const handleLanguageSelectConfirm = () => {
    if (!pendingImportData.value || selectedLanguages.value.length === 0) {
        logger.warn('没有选择任何语言');
        return;
    }

    const { csvPath, importType } = pendingImportData.value;

    if (importType === 'text') {
        emit('importCsv', csvPath, selectedLanguages.value);
    } else if (importType === 'options') {
        emit('importOptionsCsv', csvPath, selectedLanguages.value);
    }

    // 清理状态
    pendingImportData.value = null;
    showLanguageSelectModal.value = false;
};

// 处理语言选择取消
const handleLanguageSelectCancel = () => {
    pendingImportData.value = null;
    showLanguageSelectModal.value = false;
};

// 处理全选变化
const handleSelectAllChange = (event: any) => {
    const checked = event.target.checked;
    if (checked) {
        selectedLanguages.value = [...(pendingImportData.value?.csvLanguages || [])];
    } else {
        selectedLanguages.value = [];
    }
};

// 处理单个语言选择变化
const handleLanguageChange = (langCode: string, checked: boolean) => {
    if (checked) {
        if (!selectedLanguages.value.includes(langCode)) {
            selectedLanguages.value.push(langCode);
        }
    } else {
        const index = selectedLanguages.value.indexOf(langCode);
        if (index > -1) {
            selectedLanguages.value.splice(index, 1);
        }
    }
};

// 处理语言按钮切换
const handleLanguageToggle = (langCode: string) => {
    const isSelected = selectedLanguages.value.includes(langCode);
    handleLanguageChange(langCode, !isSelected);
};

// 检查是否全选
const isAllSelected = () => {
    return pendingImportData.value?.csvLanguages.length === selectedLanguages.value.length;
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
            <ui-label slot="label">CSV文件操作</ui-label>
            <div slot="content" class="csv-buttons-row">
                <UiContextMenu :items="importMenuItems" v-model:visible="importMenuVisible"
                    @select="handleImportMenuSelect">
                    <template #trigger>
                        <ui-button tooltip="从data目录选择CSV文件导入">
                            <ui-icon value="import"></ui-icon>
                            <span>导入CSV</span>
                            <ui-icon value="menu" style="margin-left: 2px; font-size: 10px;"></ui-icon>
                        </ui-button>
                    </template>
                </UiContextMenu>
                <UiContextMenu :items="exportMenuItems" v-model:visible="exportMenuVisible"
                    @select="handleExportMenuSelect">
                    <template #trigger>
                        <ui-button tooltip="导出CSV文件到指定位置">
                            <ui-icon value="export"></ui-icon>
                            <span>导出CSV</span>
                            <ui-icon value="menu" style="margin-left: 2px; font-size: 10px;"></ui-icon>
                        </ui-button>
                    </template>
                </UiContextMenu>
                <ui-button @click="handleCopyDirectory" tooltip="复制data目录路径到剪贴板">
                    <ui-icon value="copy"></ui-icon>
                    <span>复制目录</span>
                </ui-button>
            </div>
        </ui-prop>

        <!-- 语言选择Modal -->
        <UiModal v-model:visible="showLanguageSelectModal"
            :title="pendingImportData?.importType === 'options' ? '选择要导入显示配置的语言' : '选择要导入翻译内容的语言'" okText="确认导入"
            cancelText="取消" @ok="handleLanguageSelectConfirm" @cancel="handleLanguageSelectCancel">
            <div class="language-select-content">
                <div class="language-select-header">
                    <ui-label>检测到 {{ pendingImportData?.csvLanguages.length || 0 }} 种语言，请选择要导入的语言：</ui-label>
                </div>

                <!-- 全选选项 -->
                <div class="select-all-row">
                    <ui-checkbox :value="isAllSelected()" @change="handleSelectAllChange">
                        全选 ({{ selectedLanguages.length }}/{{ pendingImportData?.csvLanguages.length || 0 }})
                    </ui-checkbox>
                </div>

                <!-- 语言列表 -->
                <div class="language-list">
                    <div v-for="langCode in pendingImportData?.csvLanguages || []" :key="langCode" class="language-item"
                        :class="{ 'selected': selectedLanguages.includes(langCode) }"
                        @click="handleLanguageToggle(langCode)">
                        <ui-label>{{ langCode }}</ui-label>
                    </div>
                </div>

                <div class="language-select-footer">
                    <ui-label class="hint-text">
                        提示：只有选中的语言会被导入到当前项目中
                    </ui-label>
                </div>
            </div>
        </UiModal>
    </div>
</template>

<style scoped>
.control-panel {
    margin-bottom: 4px;
}

.csv-buttons-row {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
}

.csv-buttons-row ui-button {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 3px;
    padding: 3px 6px !important;
    font-size: 11px !important;
    min-width: auto !important;
    height: 20px !important;
    line-height: 1 !important;
    box-sizing: border-box !important;
}

.csv-buttons-row ui-button ui-icon {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 10px !important;
    width: 12px;
    height: 12px;
}

.csv-buttons-row ui-button span {
    font-size: 11px !important;
    white-space: nowrap !important;
    line-height: 1 !important;
    display: flex !important;
    align-items: center !important;
    margin: 0 !important;
    padding: 0 !important;
}

/* 语言选择Modal样式 */
.language-select-content {
    padding: 8px 0;
    min-width: 300px;
}

.language-select-header {
    margin-bottom: 16px;
}

.select-all-row {
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color, rgba(127, 127, 127, 0.2));
}

.language-list {
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: 16px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, max-content));
    gap: 8px 12px;
    justify-content: start;
}

.language-item {
    padding: 4px 8px;
    cursor: pointer;
    border-radius: 3px;
    transition: background-color 0.2s;
    user-select: none;
    display: flex;
    align-items: center;
    background-color: var(--item-background, rgba(50, 50, 50, 0.5));
    border: 1px solid var(--border-color, rgba(127, 127, 127, 0.2));
}

.language-item:hover {
    background-color: var(--item-hover, rgba(70, 70, 70, 0.4));
}

.language-item.selected {
    background-color: var(--selected-color, rgba(0, 120, 212, 0.2));
    border-color: var(--selected-border-color, rgba(0, 120, 212, 0.5));
}

.language-select-footer {
    padding-top: 8px;
    border-top: 1px solid var(--border-color, rgba(127, 127, 127, 0.2));
}

.hint-text {
    font-size: 12px;
    color: var(--text-color-secondary, rgba(127, 127, 127, 0.8));
}
</style>