import { customWeightsPlayerContextConfig } from "../config/playerContext.js";
import {
  loadPlayerContextOverrides,
  mergePlayerContextOverrides,
} from "./data/playerContextImports.js";
import { loadPlayerContextEvidenceOverrides } from "./data/playerContextEvidenceImports.js";
import { defaultPricingConfig, type PricingConfig } from "./modeling/basePricing.js";

export const defaultPlayerEvidencePath = "data/raw/player-evidence-2026-initial.csv";

export interface BuildPricingConfigFromSourcesOptions {
  customWeights?: boolean;
  playerContextPath?: string;
  playerEvidencePath?: string;
  useDefaultEvidence?: boolean;
}

export const playerEvidencePathFor = ({
  playerEvidencePath,
  useDefaultEvidence = true,
}: Pick<BuildPricingConfigFromSourcesOptions, "playerEvidencePath" | "useDefaultEvidence"> = {}): string | undefined => {
  if (playerEvidencePath !== undefined) return playerEvidencePath;
  return useDefaultEvidence ? defaultPlayerEvidencePath : undefined;
};

export const buildPricingConfigFromSources = async ({
  customWeights = false,
  playerContextPath,
  playerEvidencePath,
  useDefaultEvidence = true,
}: BuildPricingConfigFromSourcesOptions = {}): Promise<PricingConfig> => {
  const resolvedEvidencePath = playerEvidencePathFor({
    ...(playerEvidencePath === undefined ? {} : { playerEvidencePath }),
    useDefaultEvidence,
  });
  if (!customWeights && !playerContextPath && !resolvedEvidencePath) return defaultPricingConfig;

  const importedOverrides = playerContextPath ? await loadPlayerContextOverrides(playerContextPath) : [];
  const evidenceOverrides = resolvedEvidencePath
    ? await loadPlayerContextEvidenceOverrides(resolvedEvidencePath)
    : [];

  return {
    ...defaultPricingConfig,
    playerContext: {
      ...customWeightsPlayerContextConfig,
      overrides: mergePlayerContextOverrides(
        customWeightsPlayerContextConfig.overrides,
        [...importedOverrides, ...evidenceOverrides],
      ),
    },
  };
};
