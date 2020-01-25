declare module "config"
declare module "@alpacahq/alpaca-trade-api"

interface IAsset {
  id: String;
  class: String;
  exchange: String;
  symbol: String;
  status: String;
  tradable: Boolean;
  marginable: Boolean;
  shortable: Boolean;
  easy_to_borrow: Boolean;
}

interface IBarOptions {
  limit?: Number;
  start?: Date;
  end?: Date;
  after?: Date;
  until?: Date;
}


interface IBar {
  t: Number;
  o: Number;
  h: Number;
  l: Number;
  c: Number;
  v: Number;
}