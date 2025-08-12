import { name } from '../../package.json' with { type: 'json' };
import { logger } from "../utils/logger";

export const methods = {
    async open() {
        Editor.Panel.open(name);
    }
};

export async function load() {
    logger.log(`load`);    
}

export function unload() {
    logger.log(`unload`);
}
