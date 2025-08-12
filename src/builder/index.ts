import type { BuildPlugin } from '@cocos/creator-types/editor/packages/builder/@types/public';
import { logger } from '../utils/logger';

export const load: BuildPlugin.load = function () {
	logger.log('builder load');
};

export const unload: BuildPlugin.load = function () {
	logger.log('builder unload');
};

export const configs: BuildPlugin.Configs = {
	'*': { hooks: './hooks.cjs' }
};
