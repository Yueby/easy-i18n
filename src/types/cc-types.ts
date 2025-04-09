export enum SpriteType {
	/**
	 * @en
	 * The simple type.
	 *
	 * @zh
	 * 普通类型。
	 */
	SIMPLE = 0,
	/**
	 * @en
	 * The sliced type.
	 *
	 * @zh
	 * 切片（九宫格）类型。
	 */
	SLICED = 1,
	/**
	 * @en
	 * The tiled type.
	 *
	 * @zh  平铺类型
	 */
	TILED = 2,
	/**
	 * @en
	 * The filled type.
	 *
	 * @zh
	 * 填充类型。
	 */
	FILLED = 3
}

export enum SizeMode {
	/**
	 * @en
	 * Use the customized node size.
	 *
	 * @zh
	 * 使用节点预设的尺寸。
	 */
	CUSTOM = 0,
	/**
	 * @en
	 * Match the trimmed size of the sprite frame automatically.
	 *
	 * @zh
	 * 自动适配为精灵裁剪后的尺寸。
	 */
	TRIMMED = 1,
	/**
	 * @en
	 * Match the raw size of the sprite frame automatically.
	 *
	 * @zh
	 * 自动适配为精灵原图尺寸。
	 */
	RAW = 2
}

export interface Size{
    width: number;
    height: number;
}

export interface Vec2{
    x: number;
    y: number;
}
