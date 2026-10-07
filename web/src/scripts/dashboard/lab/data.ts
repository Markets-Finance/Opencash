import { templates } from "shared";
import { api, toolbox } from "../agent/session";

export type Series = templates.Series;
export const { runTemplate, simOptions } = templates;
export const loadSeries = templates.createSeriesLoader(api, () => toolbox.getMarkets());
