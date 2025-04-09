<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import UiHeader from './UiHeader.vue';

// 定义组件属性
interface Props {
  /**
   * 列表数据
   */
  items: any[];

  /**
   * 列表方向, 'horizontal' 或 'vertical'
   */
  direction?: 'horizontal' | 'vertical';

  /**
   * 选中项的索引
   */
  selectedIndex?: number;

  /**
   * 选中项的标识符属性
   */
  keyProp?: string;

  /**
   * 项目类名
   */
  itemClass?: string;

  /**
   * 禁用状态
   */
  disabled?: boolean;

  /**
   * 是否可编辑（允许添加和删除）
   */
  editable?: boolean;

  /**
   * 添加按钮文本
   */
  addText?: string;

  /**
   * 是否显示删除按钮
   */
  showRemoveButton?: boolean;

  /**
   * 列表标题
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
   * 是否使用暗色主题
   */
  dark?: boolean;

  /**
   * 项目宽度（仅横向布局有效）
   * 不设置时由内容自动撑开
   */
  itemWidth?: number | string;

  /**
   * 项目高度
   * 不设置时由内容自动撑开
   */
  itemHeight?: number | string;
}

const props = withDefaults(defineProps<Props>(), {
  direction: 'vertical',
  selectedIndex: -1,
  keyProp: 'id',
  itemClass: '',
  disabled: false,
  editable: false,
  addText: '添加项目',
  showRemoveButton: true,
  header: '',
  expand: true,
  collapsible: true,
  dark: false,
  itemWidth: undefined,
  itemHeight: undefined
});

// 定义事件
const emit = defineEmits<{
  /**
   * 选择项目时触发
   */
  (e: 'select', item: any, index: number): void;

  /**
   * 添加项目时触发
   */
  (e: 'add'): void;

  /**
   * 删除项目时触发
   */
  (e: 'remove', item: any, index: number): void;
}>();

// 当前选中的索引
const currentIndex = ref(props.selectedIndex);

// 是否展开
const isExpanded = ref(props.expand);

// 监听 selectedIndex 变化
watch(() => props.selectedIndex, (newIndex) => {
  currentIndex.value = newIndex;
});

// 计算列表项容器样式
const itemStyle = computed(() => {
  const style: Record<string, any> = {};

  // 只在有明确设置时应用样式
  if (props.direction === 'horizontal') {
    // 只在设置了宽度时应用宽度
    if (props.itemWidth !== undefined) {
      style.width = typeof props.itemWidth === 'number' ? `${props.itemWidth}px` : props.itemWidth;
      style.minWidth = style.width;
    }
  } else {
    // 纵向布局的边距
    style.margin = '2px 0';
  }

  // 只在设置了高度时应用高度
  if (props.itemHeight !== undefined) {
    style.height = typeof props.itemHeight === 'number' ? `${props.itemHeight}px` : props.itemHeight;
    style.minHeight = style.height;
  }

  return style;
});

// 切换展开状态
const toggleExpand = (expanded: boolean) => {
  isExpanded.value = expanded;
};

// 选择项目
const selectItem = (item: any, index: number) => {
  if (props.disabled) return;

  currentIndex.value = index;
  emit('select', item, index);
};

// 添加项目
const handleAdd = (event: Event) => {
  if (props.disabled) return;
  event.stopPropagation();
  emit('add');
};

// 删除项目
const removeItem = (event: Event, item: any, index: number) => {
  if (props.disabled) return;

  // 阻止事件冒泡，避免触发选择
  event.stopPropagation();

  // 发出删除事件
  emit('remove', item, index);

  // 如果删除的是当前选中项，重置选中状态
  if (index === currentIndex.value) {
    currentIndex.value = -1;
  } else if (index < currentIndex.value) {
    // 如果删除的是选中项之前的元素，更新选中索引
    currentIndex.value--;
  }
};

// 获取项目的唯一键
const getItemKey = (item: any, index: number) => {
  if (typeof item === 'object' && item !== null && props.keyProp in item) {
    return item[props.keyProp];
  }
  return index;
};
</script>

<template>
  <div class="ui-list-container" :class="{
    disabled,
    editable,
    dark,
    expanded: isExpanded || !collapsible,
    horizontal: direction === 'horizontal'
  }">
    <!-- 使用通用Header组件，直接传递title属性 -->
    <UiHeader v-if="header" :title="header" :dark="dark" :collapsible="collapsible" :expanded="isExpanded"
      @toggle="toggleExpand">
      <!-- 用户自定义的header-actions插槽内容 -->
      <slot name="header-actions"></slot>

      <!-- 添加按钮，只有在没有提供自定义header-actions且editable为true时显示 -->
      <ui-button v-if="editable" class="list-add-button" @click.stop="handleAdd">
        <ui-icon value="add"></ui-icon>
      </ui-button>
    </UiHeader>

    <!-- 列表内容 -->
    <div v-if="isExpanded" class="ui-list-content" :class="{ 'horizontal-list': direction === 'horizontal' }">
      <div v-for="(item, index) in items" :key="getItemKey(item, index)" :class="[
        'ui-list-item',
        itemClass,
        { 'selected': index === currentIndex }
      ]" :style="itemStyle" @click="selectItem(item, index)">
        <!-- 列表项内容 -->
        <div class="ui-list-item-content">
          <slot name="item" :item="item" :index="index" :selected="index === currentIndex">
            <ui-label>{{ item.toString() }}</ui-label>
          </slot>
        </div>

        <!-- 删除按钮 -->
        <div v-if="editable && showRemoveButton" class="ui-list-item-remove" @click="removeItem($event, item, index)">
          <ui-button class="remove-button" color="danger">
            <slot name="remove-icon">
              <ui-icon value="del" color="danger"></ui-icon>
            </slot>
          </ui-button>
        </div>
      </div>

      <!-- 无数据时的占位内容 -->
      <div v-if="items.length === 0" class="ui-list-empty">
        <slot name="empty">
          <ui-label class="ui-list-empty-text">暂无数据</ui-label>
        </slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ui-list-container {
  position: relative;
  border: 1px solid var(--border-color, rgba(127, 127, 127, 0.2));
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--background-color, transparent);
  transition: min-height 0.2s ease-in-out;
  margin-bottom: 6px;
  margin-top: 6px;
}

.ui-list-container.dark {
  color: var(--dark-text-color, rgba(255, 255, 255, 0.9));
}

/* 展开状态下的容器高度 */
.ui-list-container.expanded {
  min-height: 80px;
}

/* 横向列表展开状态下的容器高度 - 移除固定高度限制 */
.ui-list-container.expanded.horizontal {
  min-height: unset;
}

.ui-list-content {
  flex: 1;
  scrollbar-width: thin !important; /* Firefox滚动条宽度 */
  overflow: auto;
  padding: 4px;
}

/* 横向列表特殊样式 */
.ui-list-content.horizontal-list {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  overflow-x: auto !important;
  overflow-y: hidden !important;
  padding: 4px;
  scroll-behavior: smooth;
  white-space: nowrap;
}

.ui-list-content.horizontal-list .ui-list-item {
  flex: 0 0 auto;
  margin: 0 2px;
  display: flex;
  justify-content: center;
  padding: 2px 4px;
  height: auto;
}

/* 确保折叠时内容区域完全隐藏 */
.ui-list-container:not(.expanded) .ui-list-content {
  display: none;
}

.ui-list-item {
  position: relative;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 2px;
  transition: background-color 0.2s;
  user-select: none;
  display: flex;
  align-items: center;
}

.ui-list-item-content {
  flex: 1;
  min-width: 0;
}

.ui-list-item:hover {
  background-color: var(--hover-color, rgba(127, 127, 127, 0.1));
}

.ui-list-item.selected {
  background-color: var(--selected-color, rgba(0, 120, 212, 0.2));
}

.ui-list-container.disabled .ui-list-item {
  opacity: 0.6;
  cursor: not-allowed;
}

.ui-list-item-remove {
  margin-left: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.ui-list-item:hover .ui-list-item-remove {
  opacity: 1;
}

.remove-button {
  padding: 2px;
  min-width: auto;
  height: auto;
}

.list-add-button {
  min-width: auto;
  width: 24px;
  height: 24px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ui-list-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  min-height: 60px;
  color: var(--empty-text-color, rgba(127, 127, 127, 0.7));
}

.ui-list-empty-text {
  font-style: italic;
  opacity: 0.7;
}
</style>