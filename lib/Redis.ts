import R from 'redis'
import config from 'config'
import async from 'async'
const _ = require('lodash')

const ASYNC_LIMIT = 10

export default class Redis {
  client: R
  constructor() {
    this.client = R.createClient(config.get('redis'))
  }

  queueObj(list: String, item, cb: Function) {
    this.client.rpush(`q_${list}`, JSON.stringify(item), cb)
  }

  dequeueObj(list: String, cb: Function) {
    this.client.lpop(`q_${list}`, (err: object | null, ret: string) => {
      if(err) {
        cb(err)
      } else {
        cb(err, JSON.parse(ret))
      }
    })
  }

  storeAsset(asset: IAsset, cb: any) {
    async.auto({
      storeSymbol: (autoCallback: async.ErrorCallback) => {
        this.client.sadd('assets', asset.symbol, autoCallback)
      },
      storeAsset: (autoCallback: async.ErrorCallback) => {
        this.client.hmset(`asset_${asset.symbol}`, asset, cb)
      },
    }, ASYNC_LIMIT, cb)
  }

  getAsset(symbol: String, cb: Function) {
    this.client.hgetall(`asset_${symbol}`, cb)
  }

  getAssetList(cb: any) {
    this.client.smembers('assets', cb)
  }

  storeStreamMessage(message: NStream.NStocks.IQuote | NStream.NStocks.IQuote, cb: Function) {
    this.client.xadd('marketData', '*', "message", JSON.stringify(message), cb)
  }

}
