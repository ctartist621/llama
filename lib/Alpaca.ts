/// <reference path="../typings/index.d.ts"/>

const A = require('@alpacahq/alpaca-trade-api')
import config from 'config'
import _ from 'lodash'

import Logger from "./Logger"
const logger = new Logger("Alpaca")
import Limiter from 'limiter'

export default class Alpaca {
  client: any
  limiter: Limiter.RateLimiter
  constructor() {
    this.client = new A(config.get('alpaca'))
    this.limiter = new Limiter.RateLimiter(200, 'minute') // 200/min https://docs.alpaca.markets/api-documentation/api-v2/
  }

  private throttle(func: Function, cb: Function) {
    this.limiter.removeTokens(1, (err, remainingRequests) => {
      logger.log('silly', `Remaining Alpaca requests: ${remainingRequests}`)
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

  getAsset(symbol: string, cb: Function) {
    const func = this.client.getAsset(symbol)
      .then((asset: IAsset) => {
        cb(undefined, asset)
      }).catch(cb);

    this.throttle(func, cb)
  }

  getBars(timeframe: 'minute' | '1Min' | '5Min' | '15Min' | 'day' | '1D', symbol: string, options: IBarOptions, cb: Function) {
    const func = this.client.getBars(timeframe, symbol, options)
      .then((bars: IBar) => {
        cb(undefined, bars[symbol])
      }).catch(cb);

    this.throttle(func, cb)
  }
}