import {
  DMSans_300Light,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  useFonts,
} from "@expo-google-fonts/dm-sans";
import { DelaGothicOne_400Regular } from "@expo-google-fonts/dela-gothic-one";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Bin, TradingAccount } from "shared";
import { Account, type Profile } from "./src/screens/Account";
import { BinDetail } from "./src/screens/BinDetail";
import { Bins } from "./src/screens/Bins";
import { Trade } from "./src/screens/Trade";
import type { TabKey } from "./src/components/TabBar";
import { Home } from "./src/screens/Home";
import { Landing } from "./src/screens/Landing";
import { MarkIntro } from "./src/components/MarkIntro";
import {
  loadPositions,
  loadTokens,
  loadUsdgBalance,
  type HoodData,
} from "./src/lib/hood";
import { dark } from "./src/theme";

type Screen =
  | "landing"
  | "account"
  | "bins"
  | "bin"
  | "home"
  | "trade";

export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [bin, setBin] = useState<Bin | null>(null);
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
    DelaGothicOne_400Regular,
  });
  const [fontTimedOut, setFontTimedOut] = useState(false);
  const [intro, setIntro] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setFontTimedOut(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!loaded && !error && !fontTimedOut) {
    return <View style={{ flex: 1, backgroundColor: dark.paper }} />;
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
      <StatusBar style="light" />
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
          <Trade trader={trader} onSelectTab={goTab} />
        ) : null
      ) : screen === "home" ? (
        trader !== null ? <Home trader={trader} onSelectTab={goTab} /> : null
      ) : bin !== null && markets !== null && trader !== null ? (
        <BinDetail
          bin={bin}
          data={markets}
          balance={balance}
          trader={trader}
          onBack={() => setScreen("bins")}
        />
      ) : null}
      {intro && <MarkIntro onDone={() => setIntro(false)} />}
    </SafeAreaProvider>
  );
}
