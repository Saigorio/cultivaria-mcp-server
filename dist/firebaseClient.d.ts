/**
 * Fetch module data from Firebase RTDB with fallback
 */
export declare function getModuleData(moduleId?: string): Promise<any>;
/**
 * Patch module data in Firebase RTDB with fallback
 */
export declare function updateModuleData(path: string, patchData: Record<string, any>, moduleId?: string): Promise<{
    success: boolean;
    updated: any;
    fallbackUsed: boolean;
}>;
