import {
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  useFonts,
} from "@expo-google-fonts/dm-sans";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Bin, TradingAccount } from "shared";
import { Account, type Profile } from "./src/screens/Account";
import { AuthorizeAgent } from "./src/screens/AuthorizeAgent";
import { BinDetail } from "./src/screens/BinDetail";
import { Bins } from "./src/screens/Bins";
import { Trade } from "./src/screens/Trade";
import { TradeDetail } from "./src/screens/TradeDetail";
import type { TabKey } from "./src/components/TabBar";
import { BotHome } from "./src/screens/BotHome";
import { Landing } from "./src/screens/Landing";
import { MandateDetail } from "./src/screens/MandateDetail";
import type { Mandate } from "./src/lib/backend";
import {
  loadPositions,
  loadTokens,
  loadUsdgBalance,
  type HoodData,
  type TradeAsset,
} from "./src/lib/hood";
import { color } from "./src/theme";

type Screen =
  | "landing"
  | "account"
  | "bins"
  | "bin"
  | "agent"
  | "home"
  | "trade"
  | "tradeAsset"
  | "mandate";

export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [agentBackTo, setAgentBackTo] = useState<"account" | "home">("home");
  const [bin, setBin] = useState<Bin | null>(null);
  const [tradeAsset, setTradeAsset] = useState<TradeAsset | null>(null);
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [markets, setMarkets] = useState<HoodData | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [trader, setTrader] = useState<TradingAccount | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [portfolio, setPortfolio] = useState<number | null>(null);
  const [loaded, error] = useFonts({
    DMSans_300Light,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
  });
  const [fontTimedOut, setFontTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFontTimedOut(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!loaded && !error && !fontTimedOut) {
    return <View style={{ flex: 1, backgroundColor: color.paper }} />;
  }


  function onAuthenticated(account: TradingAccount | null) {
    setTrader(account);
    setBalance(null);
    setPortfolio(null);
    if (account === null) return;

    loadUsdgBalance(account.address)
      .then((usdg) => setBalance(usdg))
      .catch(() => setBalance(null));

    loadTokens()
      .then((data) => loadPositions(account.address, data.tokens))
      .then((held) =>
        setPortfolio(held.reduce((sum, position) => sum + position.valueUsdg, 0)),
      )
      .catch(() => setPortfolio(null));
  }

  function goTab(key: TabKey) {
    if (key === "home") setScreen("home");
    else if (key === "bins") setScreen("bins");
    else if (key === "trade") setScreen("trade");
    else setScreen("account");
  }


  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {screen === "landing" ? (
        <Landing onSignIn={() => setScreen("account")} />
      ) : screen === "account" ? (
        <Account
          initialAccount={trader}
          initialProfile={profile}
          portfolio={portfolio}
          onProfileChange={setProfile}
          onBack={() => setScreen("landing")}
          onAuthenticated={onAuthenticated}
          onInitialised={() => setScreen("home")}
          onSelectTab={goTab}
        />
      ) : screen === "agent" ? (
        trader !== null ? (
          <AuthorizeAgent trader={trader} onBack={() => setScreen(agentBackTo)} />
        ) : null
      ) : screen === "bins" ? (
        <Bins
          onSelectTab={goTab}
          onComplete={() => setScreen("home")}
          onOpen={(selected, data) => {
            setBin(selected);
            setMarkets(data);
            setScreen("bin");
          }}
        />
      ) : screen === "trade" ? (
        trader !== null ? (
          <Trade
            trader={trader}
            onSelectTab={goTab}
            onOpenAsset={(asset) => {
              setTradeAsset(asset);
              setScreen("tradeAsset");
            }}
          />
        ) : null
      ) : screen === "tradeAsset" ? (
        tradeAsset !== null && trader !== null ? (
          <TradeDetail
            asset={tradeAsset}
            balance={balance}
            trader={trader}
            onBack={() => setScreen("trade")}
          />
        ) : null
      ) : screen === "home" ? (
        trader !== null ? (
          <BotHome
            trader={trader}
            onSelectTab={goTab}
            onAuthorize={() => {
              setAgentBackTo("home");
              setScreen("agent");
            }}
            onOpenMandate={(selected) => {
              setMandate(selected);
              setScreen("mandate");
            }}
          />
        ) : null
      ) : screen === "mandate" ? (
        mandate !== null && trader !== null ? (
          <MandateDetail mandate={mandate} trader={trader} onBack={() => setScreen("home")} />
        ) : null
      ) : bin !== null && markets !== null && trader !== null ? (
        <BinDetail
          bin={bin}
          data={markets}
          balance={balance}
          trader={trader}
          onBack={() => setScreen("bins")}
        />
      ) : null}
    </SafeAreaProvider>
  );
}
