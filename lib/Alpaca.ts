
const A = require('@alpacahq/alpaca-trade-api')
import config from 'config'
import _ from 'lodash'

import Logger from "./Logger"
const logger = new Logger("Alpaca")
import Limiter from 'limiter'

interface barOptions {
  limit?: Number;
  start?: Date;
  end?: Date;
  after?: Date;
  until?: Date;
}

class Alpaca {
  client: any
  limiter: Limiter.RateLimiter
  constructor() {
    this.client = new A(config.get('alpaca'))
    this.limiter = new Limiter.RateLimiter(200, 'minute') // 200/min https://docs.alpaca.markets/api-documentation/api-v2/
  }

  getAllAssets(cb: Function) {
    this.limiter.removeTokens(1, (err, remainingRequests) => {
      if (err) {
        cb(err)
      } else {
        this.client.getAssets({})
          .then((assets: any) => {
            logger.log('info', `Retrieved ${assets.length} asset records`)
            cb(undefined, assets)
          }).catch(cb);
      }
    })
  }

  getAsset(symbol: string, cb: Function) {
    this.limiter.removeTokens(1, (err, remainingRequests) => {
      if (err) {
        cb(err)
      } else {
        this.client.getAsset(symbol)
          .then((asset: any) => {
            cb(undefined, asset)
          }).catch(cb);
      }
    })
  }

  getBars(timeframe: 'minute' | '1Min' | '5Min' | '15Min' | 'day' | '1D', symbol: string, options: barOptions, cb: Function) {
    this.limiter.removeTokens(1, (err, remainingRequests) => {
      if (err) {
        cb(err)
      } else {
        this.client.getBars(timeframe, symbol, options)
          .then((bars: any) => {
            cb(undefined, bars[symbol])
          }).catch(cb);
      }
    })
  }


}

export default Alpaca