
const A = require('@alpacahq/alpaca-trade-api')
import config from 'config'
import _ from 'lodash'

import Limiter from 'limiter'

class Alpaca {
  client: any
  limiter: Limiter.RateLimiter
  constructor() {
    this.client = new A(config.get('alpaca'))
    this.limiter = new Limiter.RateLimiter(200, 'minute') // 200/min https://docs.alpaca.markets/api-documentation/api-v2/
  }

  getAllAssets (cb: Function) {
    this.client.getAssets({})
    .then((assets: any) => {
      cb(undefined,assets)
    }).catch(cb);
  }
}

export default Alpaca