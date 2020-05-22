 /// <reference path='../typings/index.d.ts'/>
import _ from 'lodash'
import async from 'async'

import moment from 'moment'

import Alpaca from './Alpaca'
// import Redis from './Redis'

import KalmanFilter from 'kalmanjs';

import Logger from "./Logger"
const logger = new Logger("Vicuna")
import { throttle, debounce } from 'throttle-debounce';

interface IDOMRecord {
  size: number;
  ts: number;
  price: number;
  type: 'ask'|'bid';
}

interface ITradeRecord {
  size: number;
  ts: number;
  price: number;
}


export default class Vicuna {
  private alpaca: any
  // private redis: Redis
  private _account: any
  private _symbol: string
  private _feeds: string[]
  private _DOM: { [key: string]: IDOMRecord }
  private _tradeHistory: any
  private _position: IPosition
  private _tradeLocks: { [key: string]: Boolean }
  private _orderUpdate: IOrderUpdate | undefined
  private _orders: IOrder[]
  private _lastTradeTime: number

  constructor(a: Alpaca, symbol) {
    this.alpaca = a
    this._symbol = symbol
    // this.redis = new Redis()
    this._account = {}
    this._DOM = {}
    this._tradeHistory = {}
    this._orders = []
    this._lastTradeTime = moment().subtract(1, 'hour').unix()
    this._tradeLocks = {
      buy: false,
      sell: false,
    }


    this._position = {
      asset_id: '',
      symbol: '',
      exchange: '',
      asset_class: '',
      avg_entry_price: 0,
      qty: 0,
      side: '',
      market_value: 0,
      cost_basis: 0,
      unrealized_pl: 0,
      unrealized_plpc: 0,
      unrealized_intraday_pl: 0,
      unrealized_intraday_plpc: 0,
      current_price: 0,
      lastday_price: 0,
      change_today: 0
    }

    this._feeds = [
      'trade_updates',
      'account_updates',
      `T.${this._symbol}`,
      `Q.${this._symbol}`,
      `A.${this._symbol}`,
      `AM.${this._symbol}`,
    ]

    logger.log('info', "Vicuna Started")

    setInterval(() => {
      this.pruneDOM_TradeHistory()
    }, 60000)


    setInterval(() => {
      this.updateOrders()
    }, 5000)

    async.auto({
      account: (autoCallback) => {
        this.alpaca.getAccount((err, account) => {
          if (!err) {
            this._account = account
          }
          console.log(account)
          autoCallback(err, account)
        })
      },
      position: (autoCallback) => {
        this.alpaca.getPosition(this._symbol, (err, position) => {
          if (!err) {
            this._position = position
          } else {
          }
          console.log(position)
          autoCallback(err, position)
        })
      },
      order: (autoCallback) => {
        this.alpaca.getOrders((err, orders: IOrder) => {
          if (!err) {
            this._orders = (_.filter(orders, ['symbol', this._symbol]) as unknown) as IOrder[]
          } else {
          }
          // console.log(orders)
          autoCallback(err, orders)
        })
      },
    }, (err: any, results: any) => {
        logger.log("info", `State Initialization Complete`)
        if (err && err.error.code !== 40410000) {
          logger.log('error', err)
          console.log(JSON.stringify(err))
        } else {
          if (err && err.error.code == 40410000) {
            logger.log("warn", `No position exists for ${this._symbol}`)
          }
          this._initWS()
        }
    })
  }

  // _setLocks(startingOrder = false) {
  //   if (this._position) {
  //     this._tradeLocks.buy = true // Don't buy
  //     this._tradeLocks.sell = false // Allow for Sales
  //   } else {
  //     this._tradeLocks.buy = false // Allow for purchase
  //     this._tradeLocks.sell = true // Block sale
  //   }

  //   if (startingOrder) {
  //     this._tradeLocks.buy = true // Allow for purchase
  //     this._tradeLocks.sell = true // Block sale
  //   }
  // }


  _initWS() {
    logger.log("info", `Initializing Websocket`)
    this.alpaca.data_ws.connect()

    this.alpaca.data_ws.onConnect(() => {
      logger.log("info", "Connected")
      logger.log("info", `Subscribing to ${this._feeds}`)
      this.alpaca.data_ws.subscribe(this._feeds)
    })
    this.alpaca.data_ws.onDisconnect(() => {
      logger.log("info", "Disconnected")
      // process.exit()
      this.alpaca.data_ws.connect()
    })
    this.alpaca.data_ws.onStateChange(newState => {
      logger.log("info", `State changed to ${newState}`)
    })
    this.alpaca.data_ws.onOrderUpdate((data: IOrderUpdate) => {
      logger.log("info", `Order updates: ${JSON.stringify(data)}`)
      this.updateOrderStatus(data)
    })
    this.alpaca.data_ws.onAccountUpdate(data => {
      logger.log("info", `Account updates: ${JSON.stringify(data)}`)
      this.updateAccount(data)
    })
    this.alpaca.data_ws.onStockTrades((subject, data) => {
      // logger.log("silly", `Stock trades: ${subject}, ${data}`)
      const trades = JSON.parse(data)
      this.updateTradeHistory(trades)
      logger.log("silly", `${subject} $${trades[0].p} ${trades[0].s}`)
    })
    this.alpaca.data_ws.onStockQuotes((subject, data) => {
      // logger.log("debug", `Stock quotes: ${subject}, ${data}`)
      const quotes = JSON.parse(data)
      this.updateDOM(quotes)
      logger.log('silly', `${subject} $${quotes[0].ap} ${quotes[0].as} |  $${quotes[0].bp} ${quotes[0].bs}`)
    })
    this.alpaca.data_ws.onStockAggSec((subject, data) => {
      logger.log("silly", `Stock agg sec: ${subject}, ${data}`)
    })
    this.alpaca.data_ws.onStockAggMin((subject, data) => {
      logger.log("silly", `Stock agg min: ${subject}, ${data}`)
    })
  }

  updateOrders() {
    this.alpaca.getOrders((err: any, orders: IOrder[]) => {
      if (err) {
        logger.log("error", err)
      } else if (orders) {
        this._orders = orders
        logger.log("info", JSON.stringify(this._orders))
      }
    })
  }

  updateOrderStatus(update: IOrderUpdate) {
    this._orderUpdate = update
    this._orders.push(update.order)
    this._position.qty = update.position_qty ? update.position_qty : this._position.qty
    this._position.current_price = update.price ? update.price : this._position.current_price
    // console.log(update)
  }

  updatePosition() {
    this.alpaca.getPosition(this._symbol,(err: any, position: IPosition) => {
      if (err && err.error.code == 40410000) {
        logger.log("warn", `No position exists for ${this._symbol}`)
      } else if (err) {
        logger.log("error", err)
      } else if (position) {
        this._position = position
        logger.log("info", JSON.stringify(this._position))
      }
      // this._setLocks()
    })
  }

  updateAccount(account: IAccount) {
    this._account = account
    // this.alpaca.getAccount((err, account) => {
    //   if (!err) {
    //     this._account = account
    //   }
    // })
  }

  updateDOM(quotes: NStream.NStocks.IQuote[]) {
    async.each(quotes, (quote: NStream.NStocks.IQuote, eachCallback) => {
      if(quote.ap && quote.as) {
        this._DOM[quote.ap] = {
          size: quote.as * 100,
          ts: quote.t,
          price: quote.ap,
          type: 'ask',
        }
      }

      if(quote.bp && quote.bs) {
        this._DOM[quote.bp] = {
          size: quote.bs * 100,
          ts: quote.t,
          price: quote.bp,
          type: 'bid',
        }
      }
      eachCallback()
    }, (err) => {
      if(err) {
        logger.log('error', err)
      } else {
        debounce(100, this.evaluatePosition)
      }
    })
  }

  updateTradeHistory(trades: NStream.NStocks.ITrade[]) {
    async.each(trades, (trade: NStream.NStocks.ITrade, eachCallback) => {
      this._tradeHistory[trade.t] = {
        price: trade.p,
        size: trade.s,
        ts: trade.t,
      }
      eachCallback()
    }, (err) => {
      if(err) {
        logger.log('error', err)
      } else {
        debounce(100, this.evaluatePosition)
      }
    })
  }

  pruneDOM_TradeHistory() {
    this._DOM = _.omitBy(this._DOM, (item) => {
      return moment(item.ts).isBefore(moment().subtract(5, 'minute'))
    })

    this._tradeHistory = _.omitBy(this._tradeHistory, (item) => {
      return moment(item.ts).isBefore(moment().subtract(5, 'minute'))
    })

  }

  private _differentiate(set: number[]) {
      const dif = _.map(set, (s: number, i: number) => {
        if(i == 0) {
          return
        } else {
          return s - set[i-1]
        }
      })
      return _.compact(dif)
  }

  kalmanFilterPredictions(cb: any) {
    async.auto({
      tradePrice: (autoCallback) => {
        const tp = _.map(this._tradeHistory, (t) => {
          return t.price
        })
        const tpKF = new KalmanFilter({R: 0.01, Q: 3});
        const tpFiltered = tp.map(function(v) {
          return tpKF.filter(v);
        });
        autoCallback(undefined,tpFiltered)
      },
      tradePriceVelocity: ['tradePrice', (results, autoCallback) => {
        autoCallback(undefined, this._differentiate(results.tradePrice))
      }],
      tradePriceAcceleration: ['tradePriceVelocity', (results, autoCallback) => {
        autoCallback(undefined, this._differentiate(results.tradePriceVelocity))
      }],
      tradeSize: (autoCallback) => {
        const ts = _.map(this._tradeHistory, (t) => {
          return t.size
        })
        const tsKF = new KalmanFilter({R: 0.01, Q: 3});
        const tsFiltered = ts.map(function(v) {
          return tsKF.filter(v);
        });
        autoCallback(undefined,tsFiltered)
      },
      tradeSizeVelocity: ['tradeSize', (results, autoCallback) => {
        autoCallback(undefined, this._differentiate(results.tradeSize))
      }],
      tradeSizeAcceleration: ['tradeSizeVelocity', (results, autoCallback) => {
        autoCallback(undefined, this._differentiate(results.tradeSizeVelocity))
      }]

      // askPrice: (autoCallback) => {
      //   const tp = _.map(this._DOM, (t) => {
      //     return t.price
      //   })
      //   const tpKF = new KalmanFilter({R: 0.01, Q: 3});
      //   const tpFiltered = tp.map(function(v) {
      //     return tpKF.filter(v);
      //   });
      //   autoCallback(undefined,tpFiltered)
      // },
      // askPriceVelocity: ['askPrice', (results, autoCallback) => {
      //   autoCallback(undefined, this._differentiate(results.askPrice))
      // }],
      // askPriceAcceleration: ['askPriceVelocity', (results, autoCallback) => {
      //   autoCallback(undefined, this._differentiate(results.askPriceVelocity))
      // }],
      // askSize: (autoCallback) => {
      //   const ts = _.map(this._askHistory, (t) => {
      //     return t.size
      //   })
      //   const tsKF = new KalmanFilter({R: 0.01, Q: 3});
      //   const tsFiltered = tp.map(function(v) {
      //     return tsKF.filter(v);
      //   });
      //   autoCallback(undefined,tsFiltered)
      // },
      // askSizeVelocity: ['askSize', (results, autoCallback) => {
      //   autoCallback(undefined, this._differentiate(results.askSize))
      // }],
      // askSizeAcceleration: ['askSizeVelocity', (results, autoCallback) => {
      //   autoCallback(undefined, this._differentiate(results.askSizeVelocity))
      // }]


      // tradePrice: (autoCallback) => {
      //   const tp = _.map(this._tradeHistory, (t) => {
      //     return t.price
      //   })
      //   const tpKF = new KalmanFilter({R: 0.01, Q: 3});
      //   const tpFiltered = tp.map(function(v) {
      //     return tpKF.filter(v);
      //   });
      //   autoCallback(undefined,tpFiltered)
      // },
      // tradePriceVelocity: ['tradePrice', (results, autoCallback) => {
      //   autoCallback(undefined, this._differentiate(results.tradePrice))
      // }],
      // tradePriceAcceleration: ['tradePriceVelocity', (results, autoCallback) => {
      //   autoCallback(undefined, this._differentiate(results.tradePriceVelocity))
      // }],
      // tradeSize: (autoCallback) => {
      //   const ts = _.map(this._tradeHistory, (t) => {
      //     return t.size
      //   })
      //   const tsKF = new KalmanFilter({R: 0.01, Q: 3});
      //   const tsFiltered = tp.map(function(v) {
      //     return tsKF.filter(v);
      //   });
      //   autoCallback(undefined,tsFiltered)
      // },
      // tradeSizeVelocity: ['tradeSize', (results, autoCallback) => {
      //   autoCallback(undefined, this._differentiate(results.tradeSize))
      // }],
      // tradeSizeAcceleration: ['tradeSizeVelocity', (results, autoCallback) => {
      //   autoCallback(undefined, this._differentiate(results.tradeSizeVelocity))
      // }]

    }, cb)
  }

  _shouldEnterPosition(indicators) {
    if (this._throttleTrade(indicators)) {
      return false
    } else if (this._position.qty > 0) {
      logger.log('warn', `Not entering position, ${this._position.qty} > 0`)
      return false
    } else if (_.last(indicators.kalmanPredictions.tradePriceAcceleration) as number > 0) {
      logger.log('debug', `Entering position, Kalman Acceleration ${_.last(indicators.kalmanPredictions.tradePriceAcceleration)} > 0`)
      return true
    } else {
      logger.log('debug', `Entering Position`)
      return true
    }
  }

  _shouldExitPosition(indicators) {
    if(this._throttleTrade(indicators)) {
      return false
    } else if (this._position.qty > 0) {
      logger.log('warn', `Exiting position, ${this._position.qty} > 0`)
      return true
    } else if (_.last(indicators.kalmanPredictions.tradePriceAcceleration) as number < 0) {
      logger.log('debug', `Exiting position, Kalman Acceleration ${_.last(indicators.kalmanPredictions.tradePriceAcceleration)} < 0`)
      return true
    } else {
      logger.log('debug', `Exiting Position`)
      return true
    }
  }

  _throttleTrade(indicators: any) {
    const n = moment()
    const lt = moment(this._lastTradeTime).add(1, 'minute')
    if (this._orders.length > 0) {
      logger.log('warn', `Trade throttled due to existing order`)
      return true
    } else if (n.isSameOrBefore(lt)) {
      logger.log('warn', `Trade throttled: ${moment.duration(n.diff(lt)).as('seconds')}s since last trade`)
      return true
    } else {
      logger.log('debug', `Trade not throttled`)
      return false
    }
  }

  evaluatePosition() {
    // console.log("Evaluate Position")
    async.auto({
      kalmanPredictions: (autoCallback) => {
        this.kalmanFilterPredictions(autoCallback)
      }
    }, (err, results: any) => {
      if (this._shouldEnterPosition(results)) {
        this.placeBuyOrder(results)
      } else if (this._shouldExitPosition(results)) {
        this.placeSellOrder(results)
      } else {
        logger.log("silly", "Holding")
        // console.log(this._tradeLocks)
        // console.log(_.last(results.kalmanPredictions.tradePriceAcceleration))
      }
    })
  }

  placeBuyOrder(indicators) {
    if (this._tradeLocks.buy == false) {
      this._tradeLocks.buy == true
      async.auto({
        price: (autoCallback: any) => {
          let price = _.last(indicators.kalmanPredictions.tradePrice) as number * (1 + (_.last(indicators.kalmanPredictions.tradePriceVelocity) as number))
          if (_.isNaN(price)) {
            if (this._tradeHistory !== {}) {
              price = _.sample(this._tradeHistory).price
            }
          }
          autoCallback(null, price)
        },
        qty: ['price', (results: any, autoCallback: any) => {
          console.log(this._account)
          console.log(this._account.regt_buying_power * 0.01)
          console.log(this._account.regt_buying_power * 0.01)
          console.log(results.price)
          console.log(this._account.regt_buying_power * 0.01 / results.price)
          let qty: number
          if (_.isNaN(results.price)) {
            qty = 1
          } else {
            qty = Math.max(1, Math.floor(this._account.regt_buying_power * 0.01 / results.price))
          }
          console.log(qty)
          autoCallback(null, qty)
        }],
        createOrder: ['price', 'qty', (results: any, autoCallback: any) => {
          const order = this.generateMarketOrder(results.qty, 'buy')
          logger.log("info", `Placing BUY order:`)
          logger.log("info", JSON.stringify(order))
          this.alpaca.createOrder(order, (err, results) => {
            if (err && err.error.available) {
              order.qty = err.error.available
              this.alpaca.createOrder(order, autoCallback)
            } else {
              autoCallback(err, results)
            }
          })
        }],
      }, (err: any, results) => {
        if (err) {
          logger.log("error", JSON.stringify(err))
        } else {
          this._lastTradeTime = moment().unix()
        }
        this._tradeLocks.buy == false
      })
    } else {
      logger.log("warn", `Trade blocked by tradelock`)
    }
  }

  placeSellOrder(indicators) {
    if (this._tradeLocks.sell == false) {
      this._tradeLocks.sell == true
      console.log("Selling!!!", this._symbol)
      const order = this.generateMarketOrder(this._position.qty, 'sell')
      logger.log("info", `Placing SELL order:`)
      logger.log("info", JSON.stringify(order))
      this.alpaca.createOrder(order, (err: any, results) => {
        if (err) {
          logger.log("error", err)
        } else {
          this._lastTradeTime = moment().unix()
        }
        this._tradeLocks.sell == false
      })
    }
  }

  _checkLimitPrice(limit_price) {
    const currentPrice = (_.last(this._tradeHistory as any) as ITradeRecord).price
    if(0 < currentPrice && currentPrice <= 25) {
      limit_price = Math.min(currentPrice * 1.10, limit_price)
    } else if(25 < currentPrice && currentPrice <= 50) {
      limit_price = Math.min(currentPrice * 1.05, limit_price)
    } else {
      limit_price = Math.min(currentPrice * 1.03, limit_price)
    }
    return limit_price
  }

  generateMarketOrder(qty: number, side: 'buy'|'sell', time_in_force='gtc') {
    return {
      symbol: this._symbol,
      qty,
      side,
      type: 'market',
      time_in_force
    }
  }


  generateLimitOrder(qty: number, side: 'buy'|'sell', time_in_force='gtc', limit_price: number, extended_hours = false) {
    return {
      symbol: this._symbol,
      qty,
      side,
      type: 'limit',
      time_in_force,
      limit_price: this._checkLimitPrice(limit_price),
      extended_hours: extended_hours && time_in_force == 'day',
    }
  }

  generateStopOrder(qty: number, side: 'buy'|'sell', time_in_force='gtc', stop_price: number) {
    return {
      symbol: this._symbol,
      qty,
      side,
      type: 'stop',
      time_in_force,
      stop_price,
    }
  }

  generateStopLimitOrder(qty: number, side: 'buy'|'sell', time_in_force='gtc', limit_price: number, stop_price: number) {
    return {
      symbol: this._symbol,
      qty,
      side,
      type: 'stop_limit',
      time_in_force,
      limit_price: this._checkLimitPrice(limit_price),
      stop_price,
    }
  }

  // generatBracketOrder(qty: number, side: 'buy'|'sell', time_in_force='gtc', type: 'market'|'limit'|'stop'|'stop_limit',
  //   take_profit_limit_price: number, stop_loss_stop_price: number, stop_loss_limit_price?: number, limit_price?: number, stop_price?: number) {
  //   let order: IOrder
  //   switch (type) {
  //     case "limit":
  //       order = this.generateLimitOrder(qty, side, time_in_force, limit_price, False)
  //       break;
  //     case "stop":
  //       order = this.generateStopOrder(qty, side, time_in_force, stop_price)
  //       break;
  //     case "stop_limit":
  //       order = this.generateStopLimitOrder(qty, side, time_in_force, limit_price, stop_price)
  //       break;
  //     case "market":
  //     default:
  //       order = this.generateMarketOrder(qty, side, time_in_force)
  //       break;
  //   }

  //   if(side == 'buy') {
  //     take_profit_limit_price = take_profit_limit_price > stop_loss_stop_price ? take_profit_limit_price : stop_loss_stop_price * 1.0001
  //   } else {
  //     stop_loss_stop_price = stop_loss_stop_price > take_profit_limit_price ? stop_loss_stop_price : take_profit_limit_price * 1.0001
  //   }

  //   order.order_class = 'bracket'
  //   order.take_profit = {
  //     limit_price: take_profit_limit_price
  //   }
  //   order.stop_loss = {
  //     stop_price: stop_loss_stop_price,
  //   }
  //   if(stop_loss_limit_price) {
  //     order.stop_loss.limit_price = stop_loss_limit_price
  //   }
  // }

  // generateOCOOrder(qty: number, side: 'buy'|'sell', time_in_force='gtc',
  //   take_profit_limit_price: number, stop_loss_stop_price: number, stop_loss_limit_price?: number,
  //   limit_price?: number, stop_price?: number, extended_hours?: Boolean) {
  //   let order = {
  //     symbol: this._symbol,
  //     qty,
  //     side,
  //     type: 'limit',
  //     time_in_force,
  //     extended_hours: extended_hours && time_in_force == 'day'
  //   }

  //   if(side == 'buy') {
  //     take_profit_limit_price = take_profit_limit_price > stop_loss_stop_price ? take_profit_limit_price : stop_loss_stop_price * 1.0001
  //   } else {
  //     stop_loss_stop_price = stop_loss_stop_price > take_profit_limit_price ? stop_loss_stop_price : take_profit_limit_price * 1.0001
  //   }

  //   order.order_class = 'oco'
  //   order.take_profit = {
  //     limit_price: this._checkLimitPrice(take_profit_limit_price)
  //   }
  //   order.stop_loss = {
  //     stop_price: stop_loss_stop_price,
  //   }
  //   if(stop_loss_limit_price) {
  //     order.stop_loss.limit_price = stop_loss_limit_price
  //   }
  // }

  // generateOTOOrder(qty: number, side: 'buy'|'sell', time_in_force='gtc', type: 'market'|'limit'|'stop'|'stop_limit',
  //   take_profit_limit_price?: number, stop_loss_stop_price?: number, stop_loss_limit_price?: number, limit_price?: number, stop_price?: number) {
  //   let order: IOrder | undefined
  //   switch (type) {
  //     case "limit":
  //       order = generateLimitOrder(qty, side, time_in_force, limit_price, False)
  //       break;
  //     case "stop":
  //       order = generateStopOrder(qty, side, time_in_force, stop_price)
  //       break;
  //     case "stop_limit":
  //       order = generateStopLimitOrder(qty, side, time_in_force, limit_price, stop_price)
  //       break;
  //     case "market":
  //     default:
  //       order = generateMarketOrder(qty, side, time_in_force)
  //       break;
  //   }

  //   order.order_class = 'oto'

  //   if(take_profit_limit_price) {
  //     order.take_profit = {
  //       limit_price: take_profit_limit_price
  //     }
  //   } else if (stop_loss_stop_price) {
  //     order.stop_loss = {
  //       stop_price: stop_loss_stop_price,
  //     }
  //     if(stop_loss_limit_price) {
  //       order.stop_loss.limit_price = stop_loss_limit_price
  //     }
  //   }
  // }
}
