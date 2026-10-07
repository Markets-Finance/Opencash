import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  cancelOrder,
  chartRanges,
  marketLogoUrl,
  maxOrderNotionalUsd,
  minNotionalUsd,
  modifyOrder,
  placeLimitOrder,
  setLeverage,
  updateIsolatedMargin,
  type ChartRangeKey,
  type HlCandle,
  type HlDesk,
  type HlOrder,
  type HlPosition,
  type HlTif,
  type TradeMarket,
  type TradingAccount,
} from "shared";
import { AssetMark } from "../components/AssetMark";
import { BottomSheet } from "../components/BottomSheet";
import { LineChart } from "../components/LineChart";
import { TabBar, tabBarHeight, type TabKey } from "../components/TabBar";
import { getExchange, loadCandles, loadDesk, loadTradeMarkets, type HlExchange } from "../lib/hl";
import { dark, family, space, touch, track } from "../theme";

type DeskTab = "positions" | "orders" | "fills";
type Side = "buy" | "sell";
type Sheet =
  | { kind: "ticket"; side: Side }
  | { kind: "edit"; order: HlOrder }
  | { kind: "margin"; position: HlPosition; add: boolean }
  | null;
type Status = { text: string; failed: boolean } | null;

const rangeKeys = Object.keys(chartRanges) as ChartRangeKey[];
const deskTabs: [DeskTab, string][] = [
  ["positions", "Positions"],
  ["orders", "Open Orders"],
  ["fills", "Fills"],
];
const tifs: [HlTif, string][] = [
  ["Alo", "Post-only"],
  ["Gtc", "Gtc"],
  ["Ioc", "Ioc"],
];
const noWallet = "Connect wallet to trade";

function usd(value: number): string {
  return `${value < 0 ? "−" : ""}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function px(value: number): string {
  const digits = value >= 100 ? 2 : value >= 1 ? 4 : 6;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: digits })}`;
}
function pct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
function dayChange(market: TradeMarket): number {
  return market.prevDayPx > 0 ? ((market.markPx - market.prevDayPx) / market.prevDayPx) * 100 : 0;
}
function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type TradeProps = {
  trader: TradingAccount;
  onSelectTab: (key: TabKey) => void;
};

export function Trade({ trader, onSelectTab }: TradeProps) {
  const insets = useSafeAreaInsets();
  const exchange = getExchange();
  const [markets, setMarkets] = useState<TradeMarket[] | null>(null);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [coin, setCoin] = useState("BTC");
  const [range, setRange] = useState<ChartRangeKey>("1d");
  const [candles, setCandles] = useState<HlCandle[] | null>(null);
  const [desk, setDesk] = useState<HlDesk | null>(null);
  const [deskError, setDeskError] = useState<string | null>(null);
  const [tab, setTab] = useState<DeskTab>("positions");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [status, setStatus] = useState<Status>(null);

  const refreshDesk = useCallback(() => {
    loadDesk(trader.address)
      .then((next) => {
        setDesk(next);
        setDeskError(null);
      })
      .catch((error) => setDeskError(errorText(error)));
  }, [trader.address]);

  useEffect(refreshDesk, [refreshDesk]);

  useEffect(() => {
    let live = true;
    loadTradeMarkets()
      .then((list) => live && setMarkets(list.sort((a, b) => b.dayNtlVlm - a.dayNtlVlm)))
      .catch((error) => live && setMarketError(errorText(error)));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    setCandles(null);
    loadCandles(coin, range)
      .then((next) => live && setCandles(next))
      .catch(() => live && setCandles([]));
    return () => {
      live = false;
    };
  }, [coin, range]);

  const marketFor = useCallback(
    (name: string) => markets?.find((m) => m.coin === name),
    [markets],
  );
  const market = marketFor(coin) ?? null;
  const featured = useMemo(() => {
    const perps = (markets ?? []).filter((m) => m.kind === "perp").slice(0, 12);
    return market && !perps.includes(market) ? [market, ...perps] : perps;
  }, [markets, market]);

  async function runWrite(action: () => Promise<unknown>, done: string) {
    setStatus({ text: "Sending…", failed: false });
    try {
      await action();
      setStatus({ text: done, failed: false });
      refreshDesk();
      return true;
    } catch (error) {
      setStatus({ text: errorText(error), failed: true });
      return false;
    }
  }

  function cancel(order: HlOrder) {
    const target = marketFor(order.coin);
    if (!exchange || !target) return;
    void runWrite(() => cancelOrder(exchange, target.assetId, order.oid), "Order cancelled.");
  }

  const short = chartRanges[range].spanMs <= 86_400_000;
  const stamp = (time: number) =>
    short
      ? new Date(time).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
      : new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const rangeChange =
    candles && candles.length >= 2
      ? ((candles[candles.length - 1].close - candles[0].open) / candles[0].open) * 100
      : null;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text style={styles.heading}>Trade</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>Hyperliquid Testnet</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarHeight + insets.bottom + touch + space.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {marketError !== null ? (
          <Text style={styles.error}>{marketError}</Text>
        ) : market === null ? (
          <ActivityIndicator color={dark.ink} />
        ) : (
          <View style={styles.marketHead}>
            <AssetMark symbol={market.symbol} uri={marketLogoUrl(market)} size={space.xxl + space.sm} />
            <View style={styles.flex}>
              <Text style={styles.marketSymbol}>{market.symbol}</Text>
              <Text style={styles.muted}>{market.detail}</Text>
            </View>
            <View style={styles.alignEnd}>
              <Text style={styles.marketPrice}>{px(market.markPx)}</Text>
              <Text style={dayChange(market) >= 0 ? styles.up : styles.down}>
                {pct(dayChange(market))} 24h
              </Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>PRICE</Text>
            {rangeChange !== null && (
              <Text style={rangeChange >= 0 ? styles.up : styles.down}>{pct(rangeChange)} this range</Text>
            )}
          </View>
          {candles === null ? (
            <View style={styles.chartEmpty}>
              <ActivityIndicator color={dark.ink} />
            </View>
          ) : candles.length < 2 ? (
            <View style={styles.chartEmpty}>
              <Text style={styles.muted}>No trades in this range on testnet.</Text>
            </View>
          ) : (
            <>
              <LineChart
                values={candles.map((c) => c.close)}
                height={200}
                color={dark.green}
                label={(i) => `${stamp(candles[i].time)} · ${px(candles[i].close)}`}
              />
              <View style={styles.rowBetween}>
                {[0, 0.5, 1].map((f) => (
                  <Text key={f} style={styles.axis}>
                    {stamp(candles[Math.round(f * (candles.length - 1))].time)}
                  </Text>
                ))}
              </View>
            </>
          )}
          <View style={styles.segment}>
            {rangeKeys.map((key) => (
              <Pressable
                key={key}
                onPress={() => setRange(key)}
                style={[styles.segmentItem, range === key && styles.segmentItemActive]}
              >
                <Text style={[styles.segmentLabel, range === key && styles.segmentLabelActive]}>
                  {key.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {featured.map((m) => (
            <Pressable
              key={m.coin}
              onPress={() => setCoin(m.coin)}
              style={[styles.chip, m.coin === coin && styles.chipActive]}
            >
              <AssetMark symbol={m.symbol} uri={marketLogoUrl(m)} size={space.lg + space.xs} />
              <Text style={styles.chipLabel}>{m.symbol}</Text>
              <Text style={dayChange(m) >= 0 ? styles.upSmall : styles.downSmall}>{pct(dayChange(m))}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.segment}>
          {deskTabs.map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[styles.segmentItem, tab === key && styles.segmentItemActive]}
            >
              <Text style={[styles.segmentLabel, tab === key && styles.segmentLabelActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {status !== null && (
          <Text style={status.failed ? styles.error : styles.muted}>{status.text}</Text>
        )}

        {deskError !== null ? (
          <Text style={styles.error}>{deskError}</Text>
        ) : desk === null ? (
          <ActivityIndicator color={dark.ink} />
        ) : (
          <DeskList
            tab={tab}
            desk={desk}
            enabled={exchange !== null}
            marketFor={marketFor}
            onCancel={cancel}
            onEdit={(order) => setSheet({ kind: "edit", order })}
            onMargin={(position, add) => setSheet({ kind: "margin", position, add })}
          />
        )}
      </ScrollView>

      <View style={[styles.tradeBar, { bottom: tabBarHeight + insets.bottom }]}>
        <Pressable
          disabled={market === null}
          onPress={() => setSheet({ kind: "ticket", side: "buy" })}
          style={[styles.tradeButton, styles.buyButton]}
        >
          <Text style={styles.tradeLabel}>Buy / Long</Text>
        </Pressable>
        <Pressable
          disabled={market === null}
          onPress={() => setSheet({ kind: "ticket", side: "sell" })}
          style={[styles.tradeButton, styles.sellButton]}
        >
          <Text style={styles.tradeLabel}>Sell / Short</Text>
        </Pressable>
      </View>

      <BottomSheet
        title={
          sheet === null
            ? null
            : sheet.kind === "ticket"
              ? `Order · ${market?.symbol ?? ""}`
              : sheet.kind === "edit"
                ? "Edit order"
                : sheet.add
                  ? "Add margin"
                  : "Remove margin"
        }
        onClose={() => setSheet(null)}
      >
        {sheet?.kind === "ticket" && market !== null && (
          <Ticket
            market={market}
            initialSide={sheet.side}
            exchange={exchange}
            onDone={() => {
              setSheet(null);
              refreshDesk();
            }}
          />
        )}
        {sheet?.kind === "edit" && (
          <EditOrder
            order={sheet.order}
            market={marketFor(sheet.order.coin)}
            exchange={exchange}
            run={runWrite}
            onDone={() => setSheet(null)}
          />
        )}
        {sheet?.kind === "margin" && (
          <MarginForm
            position={sheet.position}
            add={sheet.add}
            market={marketFor(sheet.position.coin)}
            exchange={exchange}
            run={runWrite}
            onDone={() => setSheet(null)}
          />
        )}
      </BottomSheet>

      <TabBar active="trade" onSelect={onSelectTab} />
    </View>
  );
}

type DeskListProps = {
  tab: DeskTab;
  desk: HlDesk;
  enabled: boolean;
  marketFor: (coin: string) => TradeMarket | undefined;
  onCancel: (order: HlOrder) => void;
  onEdit: (order: HlOrder) => void;
  onMargin: (position: HlPosition, add: boolean) => void;
};

function DeskList({ tab, desk, enabled, marketFor, onCancel, onEdit, onMargin }: DeskListProps) {
  const rows =
    tab === "positions" ? desk.positions.length : tab === "orders" ? desk.orders.length : desk.fills.length;
  if (rows === 0) {
    return (
      <Text style={styles.empty}>
        {tab === "positions"
          ? "No open positions on Hyperliquid testnet for this address."
          : tab === "orders"
            ? "No open orders."
            : "No fills yet."}
      </Text>
    );
  }
  const identity = (name: string) => {
    const m = marketFor(name);
    const symbol = m?.symbol ?? name.split(":").pop()!;
    return (
      <View style={styles.rowIdentity}>
        <AssetMark symbol={symbol} uri={m ? marketLogoUrl(m) : undefined} size={space.xxl} />
        <View style={styles.flex}>
          <Text style={styles.rowTitle}>{symbol}</Text>
          <Text style={styles.muted} numberOfLines={1}>
            {m?.detail ?? name}
          </Text>
        </View>
      </View>
    );
  };
  return (
    <View style={styles.list}>
      {tab === "positions" &&
        desk.positions.map((p) => (
          <View key={p.coin} style={styles.listRow}>
            <View style={styles.rowBetween}>
              {identity(p.coin)}
              <View style={styles.alignEnd}>
                <Text style={styles.rowTitle}>{usd(p.positionValue)}</Text>
                <Text style={p.unrealizedPnl >= 0 ? styles.upSmall : styles.downSmall}>{usd(p.unrealizedPnl)}</Text>
              </View>
            </View>
            <Text style={styles.muted}>
              {p.size > 0 ? "Long" : "Short"} {Math.abs(p.size)} · entry {px(p.entryPx)} · liq{" "}
              {p.liquidationPx === null ? "—" : px(p.liquidationPx)} · {usd(p.marginUsed)} {p.leverage}x{" "}
              {p.leverageType}
            </Text>
            {p.leverageType === "isolated" && (
              <View style={styles.actions}>
                <SmallButton label="+ Margin" enabled={enabled} onPress={() => onMargin(p, true)} />
                <SmallButton label="− Margin" enabled={enabled} onPress={() => onMargin(p, false)} />
              </View>
            )}
          </View>
        ))}
      {tab === "orders" &&
        desk.orders.map((o) => (
          <View key={o.oid} style={styles.listRow}>
            <View style={styles.rowBetween}>
              {identity(o.coin)}
              <View style={styles.alignEnd}>
                <Text style={o.isBuy ? styles.up : styles.down}>{o.isBuy ? "Buy" : "Sell"}</Text>
                <Text style={styles.muted}>{usd(o.price * o.size)}</Text>
              </View>
            </View>
            <Text style={styles.muted}>
              {o.size} @ {px(o.price)} · {o.tif ?? "—"}
              {o.reduceOnly ? " · reduce-only" : ""}
            </Text>
            <View style={styles.actions}>
              <SmallButton label="Edit" enabled={enabled} onPress={() => onEdit(o)} />
              <SmallButton label="Cancel" enabled={enabled} onPress={() => onCancel(o)} />
            </View>
          </View>
        ))}
      {tab === "fills" &&
        desk.fills.map((f, i) => (
          <View key={`${f.time}-${i}`} style={styles.listRow}>
            <View style={styles.rowBetween}>
              {identity(f.coin)}
              <View style={styles.alignEnd}>
                <Text style={styles.rowTitle}>{f.dir}</Text>
                <Text style={f.closedPnl >= 0 ? styles.upSmall : styles.downSmall}>{usd(f.closedPnl)}</Text>
              </View>
            </View>
            <Text style={styles.muted}>
              {f.size} @ {px(f.price)} · fee {usd(f.fee)} · {new Date(f.time).toLocaleString()}
            </Text>
          </View>
        ))}
    </View>
  );
}

type SmallButtonProps = { label: string; enabled: boolean; onPress: () => void };

function SmallButton({ label, enabled, onPress }: SmallButtonProps) {
  return (
    <Pressable
      disabled={!enabled}
      onPress={onPress}
      style={[styles.smallButton, !enabled && styles.disabled]}
    >
      <Text style={styles.smallLabel}>{label}</Text>
    </Pressable>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  editable: boolean;
};

function Field({ label, value, onChange, editable }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={editable}
        keyboardType="decimal-pad"
        style={[styles.input, !editable && styles.disabled]}
        placeholderTextColor={dark.muted}
      />
    </View>
  );
}

type ToggleProps<T extends string> = {
  options: [T, string][];
  value: T;
  onChange: (value: T) => void;
  enabled: boolean;
};

function Toggle<T extends string>({ options, value, onChange, enabled }: ToggleProps<T>) {
  return (
    <View style={[styles.segment, !enabled && styles.disabled]}>
      {options.map(([key, label]) => (
        <Pressable
          key={key}
          disabled={!enabled}
          onPress={() => onChange(key)}
          style={[styles.segmentItem, value === key && styles.segmentItemActive]}
        >
          <Text style={[styles.segmentLabel, value === key && styles.segmentLabelActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

type SubmitProps = { label: string; enabled: boolean; onPress: () => void; status: Status };

function Submit({ label, enabled, onPress, status }: SubmitProps) {
  return (
    <>
      <Pressable
        disabled={!enabled}
        onPress={onPress}
        style={[styles.primary, !enabled && styles.disabled]}
      >
        <Text style={styles.primaryLabel}>{label}</Text>
      </Pressable>
      {status !== null && <Text style={status.failed ? styles.error : styles.muted}>{status.text}</Text>}
    </>
  );
}

type TicketProps = {
  market: TradeMarket;
  initialSide: Side;
  exchange: HlExchange | null;
  onDone: () => void;
};

function Ticket({ market, initialSide, exchange, onDone }: TicketProps) {
  const [side, setSide] = useState<Side>(initialSide);
  const [price, setPrice] = useState(String(market.markPx));
  const [notional, setNotional] = useState("10.2");
  const [leverage, setLeverageValue] = useState(String(Math.min(5, market.maxLeverage)));
  const [margin, setMargin] = useState<"cross" | "isolated">("cross");
  const [tif, setTif] = useState<HlTif>("Alo");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const enabled = exchange !== null && !busy;
  const size = Number(notional) / Number(price);

  async function submit() {
    if (!exchange) return;
    const p = Number(price);
    const n = Number(notional);
    if (!(p > 0) || !(n > 0)) return setStatus({ text: "Enter a price and notional.", failed: true });
    if (n > maxOrderNotionalUsd) return setStatus({ text: `Max $${maxOrderNotionalUsd.toFixed(2)} per order.`, failed: true });
    if (n < minNotionalUsd && !reduceOnly) {
      return setStatus({ text: `Hyperliquid minimum is $${minNotionalUsd}.`, failed: true });
    }
    setBusy(true);
    setStatus({ text: "Placing order…", failed: false });
    try {
      if (market.kind === "perp" && !reduceOnly) {
        await setLeverage(exchange, market.assetId, Number(leverage), margin === "cross");
      }
      await placeLimitOrder(exchange, {
        assetId: market.assetId,
        isBuy: side === "buy",
        price: p,
        size: n / p,
        szDecimals: market.szDecimals,
        kind: market.kind,
        tif,
        reduceOnly,
        maxNotionalUsd: maxOrderNotionalUsd,
      });
      onDone();
    } catch (error) {
      setStatus({ text: errorText(error), failed: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Toggle
        options={[
          ["buy", "Buy / Long"],
          ["sell", "Sell / Short"],
        ]}
        value={side}
        onChange={setSide}
        enabled={enabled}
      />
      <Field label="LIMIT PRICE" value={price} onChange={setPrice} editable={enabled} />
      <Field label="NOTIONAL (USD)" value={notional} onChange={setNotional} editable={enabled} />
      {market.kind === "perp" && (
        <View style={styles.pair}>
          <View style={styles.flex}>
            <Field label={`LEVERAGE (MAX ${market.maxLeverage}x)`} value={leverage} onChange={setLeverageValue} editable={enabled} />
          </View>
          <View style={[styles.flex, styles.field]}>
            <Text style={styles.fieldLabel}>MARGIN</Text>
            <Toggle
              options={[
                ["cross", "Cross"],
                ["isolated", "Isolated"],
              ]}
              value={margin}
              onChange={setMargin}
              enabled={enabled}
            />
          </View>
        </View>
      )}
      <Text style={styles.fieldLabel}>TIME IN FORCE</Text>
      <Toggle options={tifs} value={tif} onChange={setTif} enabled={enabled} />
      <Toggle
        options={[
          ["off", "Open / add"],
          ["on", "Reduce-only"],
        ]}
        value={reduceOnly ? "on" : "off"}
        onChange={(value) => setReduceOnly(value === "on")}
        enabled={enabled}
      />
      <Text style={styles.muted}>
        {size > 0 && Number.isFinite(size) ? `≈ ${size.toFixed(market.szDecimals)} ${market.symbol} · ` : ""}min $
        {minNotionalUsd}, max ${maxOrderNotionalUsd.toFixed(2)}
      </Text>
      <Submit
        label={exchange ? `Place ${side === "buy" ? "buy" : "sell"} order` : noWallet}
        enabled={enabled}
        onPress={() => void submit()}
        status={status}
      />
    </>
  );
}

type WriteRunner = (action: () => Promise<unknown>, done: string) => Promise<boolean>;

type EditOrderProps = {
  order: HlOrder;
  market: TradeMarket | undefined;
  exchange: HlExchange | null;
  run: WriteRunner;
  onDone: () => void;
};

function EditOrder({ order, market, exchange, run, onDone }: EditOrderProps) {
  const [price, setPrice] = useState(String(order.price));
  const [size, setSize] = useState(String(order.size));
  const enabled = exchange !== null && market !== undefined;

  async function submit() {
    if (!exchange || !market) return;
    const tif: HlTif = order.tif === "Alo" || order.tif === "Ioc" ? order.tif : "Gtc";
    const ok = await run(
      () =>
        modifyOrder(exchange, order.oid, {
          assetId: market.assetId,
          isBuy: order.isBuy,
          price: Number(price),
          size: Number(size),
          szDecimals: market.szDecimals,
          kind: market.kind,
          tif,
          reduceOnly: order.reduceOnly,
          maxNotionalUsd: maxOrderNotionalUsd,
        }),
      "Order updated.",
    );
    if (ok) onDone();
  }

  return (
    <>
      <Field label="LIMIT PRICE" value={price} onChange={setPrice} editable={enabled} />
      <Field label={`SIZE (${market?.symbol ?? order.coin})`} value={size} onChange={setSize} editable={enabled} />
      <Submit label={exchange ? "Save changes" : noWallet} enabled={enabled} onPress={() => void submit()} status={null} />
    </>
  );
}

type MarginFormProps = {
  position: HlPosition;
  add: boolean;
  market: TradeMarket | undefined;
  exchange: HlExchange | null;
  run: WriteRunner;
  onDone: () => void;
};

function MarginForm({ position, add, market, exchange, run, onDone }: MarginFormProps) {
  const [amount, setAmount] = useState("");
  const enabled = exchange !== null && market !== undefined;

  async function submit() {
    if (!exchange || !market || !(Number(amount) > 0)) return;
    const value = Number(amount);
    const ok = await run(
      () => updateIsolatedMargin(exchange, market.assetId, position.size > 0, add ? value : -value),
      "Margin updated.",
    );
    if (ok) onDone();
  }

  return (
    <>
      <Text style={styles.muted}>Isolated margin now {usd(position.marginUsed)}.</Text>
      <Field label="AMOUNT (USD)" value={amount} onChange={setAmount} editable={enabled} />
      <Submit
        label={exchange ? (add ? "Add margin" : "Remove margin") : noWallet}
        enabled={enabled}
        onPress={() => void submit()}
        status={null}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dark.paper },
  header: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: {
    fontFamily: family.semibold,
    fontSize: 25,
    letterSpacing: track(25, -0.04),
    color: dark.ink,
  },
  badge: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: space.md,
    backgroundColor: dark.surfaceHover,
  },
  badgeLabel: { fontFamily: family.medium, fontSize: 11, color: dark.ink },
  content: { padding: space.lg, gap: space.lg },
  flex: { flex: 1, minWidth: 0 },
  alignEnd: { alignItems: "flex-end" },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  marketHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  marketSymbol: { fontFamily: family.semibold, fontSize: 19, color: dark.ink },
  marketPrice: {
    fontFamily: family.semibold,
    fontSize: 25,
    letterSpacing: track(25, -0.03),
    color: dark.ink,
  },
  muted: { fontFamily: family.regular, fontSize: 12, color: dark.muted },
  up: { fontFamily: family.medium, fontSize: 13, color: dark.green },
  down: { fontFamily: family.medium, fontSize: 13, color: dark.red },
  upSmall: { fontFamily: family.regular, fontSize: 11, color: dark.green },
  downSmall: { fontFamily: family.regular, fontSize: 11, color: dark.red },
  error: { fontFamily: family.regular, fontSize: 13, color: dark.red },
  empty: { fontFamily: family.regular, fontSize: 13, color: dark.muted, textAlign: "center", paddingVertical: space.xl },
  card: {
    padding: space.lg,
    gap: space.md,
    borderRadius: space.lg,
    borderWidth: 1,
    borderColor: dark.surfaceLine,
    backgroundColor: dark.surface,
  },
  sectionTitle: {
    fontFamily: family.medium,
    fontSize: 11,
    letterSpacing: track(11, 0.12),
    color: dark.muted,
  },
  chartEmpty: { height: 200, alignItems: "center", justifyContent: "center" },
  axis: { fontFamily: family.regular, fontSize: 11, color: dark.muted },
  segment: {
    flexDirection: "row",
    padding: space.xs,
    gap: space.xs,
    borderRadius: space.md,
    backgroundColor: dark.surfaceHover,
  },
  segmentItem: {
    flex: 1,
    minHeight: touch - space.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: space.sm,
  },
  segmentItemActive: { backgroundColor: dark.line },
  segmentLabel: { fontFamily: family.medium, fontSize: 13, color: dark.muted },
  segmentLabelActive: { color: dark.ink },
  chips: { gap: space.sm },
  chip: {
    minHeight: touch,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: touch / 2,
    borderWidth: 1,
    borderColor: dark.surfaceLine,
    backgroundColor: dark.surface,
  },
  chipActive: { borderColor: dark.green },
  chipLabel: { fontFamily: family.semibold, fontSize: 13, color: dark.ink },
  list: {
    borderRadius: space.lg,
    borderWidth: 1,
    borderColor: dark.surfaceLine,
    backgroundColor: dark.surface,
    overflow: "hidden",
  },
  listRow: {
    padding: space.md,
    gap: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: dark.surfaceLine,
  },
  rowIdentity: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.sm },
  rowTitle: { fontFamily: family.semibold, fontSize: 14, color: dark.ink },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm },
  smallButton: {
    minHeight: touch,
    paddingHorizontal: space.lg,
    justifyContent: "center",
    borderRadius: touch / 2,
    backgroundColor: dark.surfaceHover,
  },
  smallLabel: { fontFamily: family.medium, fontSize: 13, color: dark.ink },
  disabled: { opacity: 0.45 },
  tradeBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: dark.surfaceLine,
    backgroundColor: dark.paper,
  },
  tradeButton: {
    flex: 1,
    minHeight: touch,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: touch / 2,
  },
  buyButton: { backgroundColor: dark.green },
  sellButton: { backgroundColor: dark.red },
  tradeLabel: { fontFamily: family.semibold, fontSize: 15, color: dark.paper },
  pair: { flexDirection: "row", gap: space.sm, alignItems: "flex-end" },
  field: { gap: space.xs },
  fieldLabel: {
    fontFamily: family.medium,
    fontSize: 10,
    letterSpacing: track(10, 0.12),
    color: dark.muted,
  },
  input: {
    minHeight: touch,
    paddingHorizontal: space.md,
    borderRadius: space.sm,
    borderWidth: 1,
    borderColor: dark.line,
    backgroundColor: dark.paper,
    fontFamily: family.medium,
    fontSize: 15,
    color: dark.ink,
  },
  primary: {
    minHeight: touch + space.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: (touch + space.sm) / 2,
    backgroundColor: dark.accent,
  },
  primaryLabel: { fontFamily: family.semibold, fontSize: 15, color: dark.onAccent },
});
