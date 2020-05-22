declare module "config"
declare module "@alpacahq/alpaca-trade-api"

interface IAccount {
  account_blocked: Boolean;
  account_number: string;
  buying_power: number;
  cash: number;
  created_at: string;
  currency: string;
  daytrade_count: number;
  daytrading_buying_power: number;
  equity: number;
  id: string;
  initial_margin: number;
  last_equity: number;
  last_maintenance_margin: number;
  long_market_value: number;
  maintenance_margin: number;
  multiplier: number;
  pattern_day_trader: Boolean;
  portfolio_value: number;
  regt_buying_power: number;
  short_market_value: number;
  shorting_enabled: Boolean;
  sma: number;
  status: string;
  trade_suspended_by_user: Boolean;
  trading_blocked: Boolean;
  transfers_blocked: Boolean;
}

interface IPosition {
  asset_id: string,
  symbol: string,
  exchange: string,
  asset_class: string,
  avg_entry_price: number,
  qty: number,
  side: string,
  market_value: number,
  cost_basis: number,
  unrealized_pl: number,
  unrealized_plpc: number,
  unrealized_intraday_pl: number,
  unrealized_intraday_plpc: number,
  current_price: number,
  lastday_price: number,
  change_today: number
}

interface IOrder {
  symbol: string;
  qty: number;
  side: 'buy'|'sell';
  type: 'market'|'limit'|'stop'|'stop_limit';
  time_in_force: 'day'|'gtc'|'opg'|'cls'|'ioc'|'fok';
  limit_price?: number;
  stop_price?: number;
  extended_hours?: Boolean;
  client_order_id?: string;
  order_class?: 'simple'|'bracket'|'oco'|'oto'
  take_profit?: {
    limit_price: number;
  };
  stop_loss?: {
    stop_price: number;
    limit_price?: number;
  };
}

declare enum ETradeEvents {
  'new',
  'fill',
  'partial_fill',
  'canceled',
  'expired',
  'done_for_day',
  'replaced',
  'rejected',
  'pending_new',
  'pending_cancel',
  'pending_replace',
  'calculated',
  'suspended',
  'order_replace_rejected',
  'order_cancel_rejected'
}

interface IOrderUpdate {
  event: ETradeEvents;
  price?: number;
  position_qty?: number;
  timestamp: string;
  order: IOrder
}

interface IAccountUpdate {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string;
  status: string;
  currency: string;
  cash: number;
  cash_withdrawable: number;
}

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

interface IWatchlist {
  id: string;
  account_id: string;
  created_at: Date;
  updated_at: string;
  name: string;
  assets?: IAsset[];
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

