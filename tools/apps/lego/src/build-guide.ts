export const buildModelIds=['cottage','tree','car','robot','castle'] as const;
export type BuildModelId=typeof buildModelIds[number];
export interface BuildGuide {modelId:BuildModelId;version:1}
