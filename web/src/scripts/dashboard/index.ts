if (location.search !== "") history.replaceState(null, "", location.pathname + location.hash);

import { initAccount } from "./account";
import { initAnalytics } from "./analytics";
import { initAgent } from "./agent";
import { initBins } from "./bins";
import { initBots, startBots } from "./bots";
import { initGate } from "./gate";
import { startTourOnce } from "./tour";
import { initRanks } from "./ranks";
import { initHome } from "./home";
import "./modal";
import { initFunds } from "./funds";
import { initChartSize } from "./chartSize";
import { initSwitchers } from "./switcher";
import { initAccountMenu, initTabs } from "./tabs";
import { startSweep } from "./sweep";
import { initTrade, openAsset, setTradeQuery } from "./trade";

initTabs({ analytics: initAnalytics, agent: initAgent, bins: initBins, trade: initTrade, account: initAccount });
initSwitchers();
initFunds();
let ranksStarted = false;
document.addEventListener("switcher:change", (event) => {
  const { group, key } = (event as CustomEvent<{ group: string; key: string }>).detail;
  if (group === "bins" && key === "ranks" && !ranksStarted) {
    ranksStarted = true;
    void initRanks();
  }
});
initAccountMenu(setTradeQuery);
document.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>("[data-open-asset]");
  if (target?.dataset.openAsset) openAsset(target.dataset.openAsset);
});
initBots();
initChartSize();
initGate(() => {
  void initHome();
  void startBots();
  startSweep();
  startTourOnce();
});
