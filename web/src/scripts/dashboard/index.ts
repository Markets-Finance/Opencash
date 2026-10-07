import { initAccount } from "./account";
import { initAgent } from "./agent";
import { initBins } from "./bins";
import { initBots, startBots } from "./bots";
import { initGate } from "./gate";
import { initRanks } from "./ranks";
import { initHome } from "./home";
import "./modal";
import { initAccountMenu, initTabs } from "./tabs";
import { initTrade, openAsset, setTradeQuery } from "./trade";

initTabs({ agent: initAgent, ranks: initRanks, bins: initBins, trade: initTrade, account: initAccount });
initAccountMenu(setTradeQuery);
document.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-open-asset]");
  if (target?.dataset.openAsset) openAsset(target.dataset.openAsset);
});
initBots();
initGate(() => {
  void initHome();
  void startBots();
});
