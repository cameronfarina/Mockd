import { keepers } from "../config/keepers.js";

export const keeperSummary = () => {
  const confirmed = keepers.filter(keeper => keeper.status === "confirmed");
  const assumed = keepers.filter(keeper => keeper.status === "assumed");
  const committed = confirmed.reduce((sum, keeper) => sum + keeper.newCost, 0);

  return {
    confirmed,
    assumed,
    confirmedCount: confirmed.length,
    committed,
    auctionDollarsRemaining: 14 * 200 - committed,
  };
};
