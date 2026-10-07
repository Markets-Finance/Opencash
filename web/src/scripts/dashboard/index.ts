import { initAccount } from "./account";
import { initBins } from "./bins";
import { initGate } from "./gate";
import { initHome } from "./home";
import "./modal";
import { initAccountMenu, initTabs } from "./tabs";
import { initTrade, setTradeQuery } from "./trade";

initTabs({ bins: initBins, trade: initTrade, account: initAccount });
initAccountMenu(setTradeQuery);
initGate(() => void initHome());
