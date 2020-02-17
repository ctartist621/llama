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

interface INews {
  symbols: string[];
  timestamp: string;
  title: string;
  url: string;
  source: string;
  summary: string;
  image: string;
  keywords: string[]
}

// Polygon Stream Data
declare namespace NStream {
  namespace NStocks {
    interface ITrade {
      ev: string;  // Event Type
      sym: string; // Symbol Ticker
      x: string;   // Exchange ID
      i: number;   // Trade ID
      z: Tape;     // Tape ( 1=A 2=B 3=C)
      p: number;   // Price
      s: number;   // Trade Size
      c: number[]; // Trade Conditions
      t: number;   // Trade Timestamp ( Unix MS )
    }

    interface IQuote {
      ev: string;  // Event Type
      sym: string; // Symbol Ticker
      bx: string;  // Bix Exchange ID
      bp: number;  // Bid Price
      bs: number;  // Bid Size
      ax: string;  // Ask Exchange ID
      ap: number;  // Ask Price
      as: number;  // Ask Size
      c: number;   // Quote Condition
      t: number;   // Quote Timestamp ( Unix MS )
    }

    interface IAggregate {
      ev: string;  // Event Type
      sym: string; // Symbol Ticker
      v: number;   // Tick Volume
      av: number;  // Accumulated Volume ( Today )
      op: number;  // Todays official opening price
      vw: number;  // VWAP (Volume Weighted Average Price)
      o: number;   // Tick Open Price
      c: number;   // Tick Close Price
      h: number;   // Tick High Price
      l: number;   // Tick Low Price
      a: number;   // Tick Average / VWAP Price
      s: number;   // Tick Start Timestamp ( Unix MS )
      e: number;   // Tick End Timestamp ( Unix MS )
    }

    enum Tape {
      A = 1,
      B = 2,
      C = 3,
    }
  }
}

