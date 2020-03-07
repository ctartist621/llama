/// <reference path="../typings/index.d.ts"/>

const A = require('@alpacahq/alpaca-trade-api')
import config from 'config'
import _ from 'lodash'

import Logger from "./Logger"
const logger = new Logger("Alpaca")
import Limiter from 'limiter'
import retry from 'retry'

const ALPACA_RATE_LIMIT = 200 // 200/min https://docs.alpaca.markets/api-documentation/api-v2/

export default class Alpaca {
  client: any
  limiter: Limiter.RateLimiter
  websocket: any
  constructor() {
    this.client = new A(config.get('alpaca'))
    this.websocket = this.client.websocket
    this.limiter = new Limiter.RateLimiter(ALPACA_RATE_LIMIT, 'minute')
  }

  private throttle(func: Function, cb: Function) {
    this.limiter.removeTokens(1, (err, remainingRequests) => {
      if (remainingRequests < ALPACA_RATE_LIMIT/2) {
        logger.log('warn', `Remaining Alpaca requests: ${remainingRequests}`)
      } else {
        logger.log('silly', `Remaining Alpaca requests: ${remainingRequests}`)
      }
      if (err) {
        cb(err)
      } else {
        func
      }
    })
  }

  getAllAssets(cb: Function) {
    const func = this.client.getAssets({})
    .then((assets: IAsset[]) => {
      logger.log('info', `Retrieved ${assets.length} asset records`)
      cb(undefined, assets)
    }).catch(cb);

    this.throttle(func, cb)
  }

  getAnalysts(symbol: string, cb: Function) {
    const func = this.client.getAnalysts(symbol)
      .then((news: IAsset) => {
        cb(undefined, news)
      }).catch(cb);

    this.throttle(func, cb)
  }

  getAsset(symbol: string, cb: Function) {
    const func = this.client.getAsset(symbol)
      .then((asset: IAsset) => {
        cb(undefined, asset)
      }).catch(cb);

    this.throttle(func, cb)
  }

  getBars(timeframe: 'minute' | '1Min' | '5Min' | '15Min' | 'day' | '1D', symbols: string | string[], options: IBarOptions, cb: Function) {
    const operation = retry.operation({
      forever: true,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: Infinity,
      randomize: true,
    })

    symbols = _.isArray(symbols) ? _.join(symbols, ',') : symbols
    const func = operation.attempt((currentAttempt) => {
      this.client.getBars(timeframe, symbols, options)
        .then((bars: IBar) => {
          logger.log('debug', `${timeframe} Bars retrieved ${symbols}`)
          cb(undefined, bars)
        }).catch((err) => {
          logger.log('error', err)
          if (err = 'StatusCodeError: 500 - {"code":50010000,"message":"internal server error occurred"}') {
            logger.log('warn', `Alpaca server error, skipping ${symbols} ${timeframe}`)
            cb()
          } else {
            logger.log('warn', `Retrying bar request ${symbols} ${timeframe}`)
            if (operation.retry(err)) {
              return
            } else {
              cb(err ? operation.mainError() : null);
            }
          }
        });

      this.throttle(func, cb)
    })
  }

  getClock(cb: Function) {
    const func = this.client.getClock()
      .then((clock: IAsset) => {
        cb(undefined, clock)
      }).catch(cb);

    this.throttle(func, cb)
  }

  getExchanges(cb: Function) {
    const func = this.client.getExchanges()
      .then((clock: IAsset) => {
        cb(undefined, clock)
      }).catch(cb);

    this.throttle(func, cb)
  }

  getNews(symbol: string, cb: Function) {
    const func = this.client.getNews(symbol)
      .then((news: IAsset) => {
        cb(undefined, news)
      }).catch(cb);

    this.throttle(func, cb)
  }
}
