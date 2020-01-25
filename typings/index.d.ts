declare module "config"
declare module "@alpacahq/alpaca-trade-api"

interface IAsset {
  id: string;
  class: string;
  exchange: string;
  symbol: string;
  status: string;
  tradable: Boolean;
  marginable: Boolean;
  shortable: Boolean;
  easy_to_borrow: Boolean;
}

interface IBarOptions {
  limit?: number;
  start?: Date;
  end?: Date;
  after?: Date;
  until?: Date;
}

interface IBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface IAssetBar {
  symbol: string;
  timeframe: string;
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}