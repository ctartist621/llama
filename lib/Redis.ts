import R from 'redis'
import config from 'config'
import async from 'async'
const _ = require('lodash')


import Logger from "./Logger"
const logger = new Logger("Redis")

const ASYNC_LIMIT = 10

export default class Redis {
  client: R
  streamPointer: string
  streamGroup: string

  constructor(streamGroup='Processor') {
    this.client = R.createClient(config.get('redis'))
    this.streamPointer = "0-0"
    this.streamGroup = streamGroup
    this.client.xgroup('CREATE', 'marketData', this.streamGroup, 0, (err) => {

    })
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

  storeStreamMessage(message: any) {
    this.client.xadd('marketData', '*', "message", message)
  }

  readStreamInterator(count: number, cb: Function) {
    this.client.xreadgroup('GROUP', this.streamGroup, process.pid, 'COUNT', count, 'STREAMS', 'marketData', '>', (err, s) => {
      if(err) {
        logger.log('error', err)
        cb(err)
      } else {
        cb(err, JSON.parse(_.flattenDeep(s)[3]))
      }
    })
  }

  updateQuote(message: NStream.NStocks.IQuote, cb: any) {
    logger.log('silly', `updateQuote: ${JSON.stringify(message)}`)
    this.client.hmset(`Q_${message.sym}`, _.flatten(_.toPairs(_.omit(message, ['ev', 'sym']))), (err, s) => {
      if (err) {
        logger.log('error', err)
      }
      cb(err)
    })
  }

  ackStreamMessage(id: string, cb: Function) {
    this.client.xack('markerData', this.streamGroup, id, cb)
  }

}
