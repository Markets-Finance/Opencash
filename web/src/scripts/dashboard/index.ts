import { initAccount } from "./account";
import { initAgent } from "./agent";
import { initBins } from "./bins";
import { initBots, startBots } from "./bots";
import { initGate } from "./gate";
import { initHome } from "./home";
import "./modal";
import { initAccountMenu, initTabs } from "./tabs";
import { initTrade, setTradeQuery } from "./trade";

initTabs({ agent: initAgent, bins: initBins, trade: initTrade, account: initAccount });
initAccountMenu(setTradeQuery);
initBots();
initGate(() => {
  void initHome();
  void startBots();
});
