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
  constructor() {
    this.client = new A(config.get('alpaca'))
    this.limiter = new Limiter.RateLimiter(ALPACA_RATE_LIMIT, 'minute')
  }

  private throttle(func: Function, cb: Function) {
    this.limiter.removeTokens(1, (err, remainingRequests) => {
      logger.log('silly', `Remaining Alpaca requests: ${remainingRequests}`)
      if (err) {
        console.log(err)
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

  getAsset(symbol: string, cb: Function) {
    const func = this.client.getAsset(symbol)
      .then((asset: IAsset) => {
        cb(undefined, asset)
      }).catch(cb);

    this.throttle(func, cb)
  }

  getBars(timeframe: 'minute' | '1Min' | '5Min' | '15Min' | 'day' | '1D', symbol: string, options: IBarOptions, cb: Function) {
    const operation = retry.operation({
      forever: true,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: Infinity,
      randomize: true,
    })

    const func = operation.attempt((currentAttempt) => {
      this.client.getBars(timeframe, symbol, options)
        .then((bars: IBar) => {
          logger.log('info', `Bars retrieved ${symbol} ${timeframe}`)
          cb(undefined, bars[symbol])
        }).catch((err) => {
          logger.log('warn', `Retrying bar request ${symbol} ${timeframe}`)
          if(operation.retry(err)) {
            return
          } else {
            cb(err ? operation.mainError() : null);
          }
        });

      this.throttle(func, cb)
    })
  }
}