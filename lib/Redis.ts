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
    this.client.xgroup('CREATE', 'stockMarketData', this.streamGroup, 0, (err) => {})
    this.client.xgroup('CREATE', 'cryptoMarketData', this.streamGroup, 0, (err) => {})
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

  storeStreamMessage(streamName: string, message: any) {
    this.client.xadd(streamName, '*', "message", message)

    // let func: any = async.retry({
    //   times: 10,
    //   interval: function(retryCount) {
    //     const INTERVAL = 50 * Math.pow(2, retryCount)
    //     logger.log('debug', `Retrying to Store Stream Message after ${INTERVAL}ms`)
    //     return INTERVAL;
    //   }
    // }, (retryCallback) => {
    //     this.client.xadd(streamName, '*', "message", message, retryCallback)
    // }, (err, result) => {
    //   if(err) {
    //     logger.log('error', err)
    //   }
    //   func = null
    // });
  }

  readStreamInterator(streamName: string, count: number, cb: Function) {
    this.client.xreadgroup('GROUP', this.streamGroup, process.pid, 'COUNT', count, 'STREAMS', streamName, '>', (err, s) => {
      if(err) {
        logger.log('error', err)
        cb(err)
      } else {
        const withIds = _.map(s[0][1], (m) => {
          return {
            updates: JSON.parse(m[1][1]),
            id: m[0]
          }
        })
        cb(err, withIds)
      }
    })
  }

  // updateQuote(message: NStream.NStocks.IQuote, cb: any) {
  //   logger.log('silly', `updateQuote: ${JSON.stringify(message)}`)
  //   this.client.hmset(`Q_${message.sym}`, _.flatten(_.toPairs(_.omit(message, ['ev', 'sym']))), (err, s) => {
  //     if (err) {
  //       logger.log('error', err)
  //     }
  //     cb(err)
  //   })
  // }

  updateQuoteBook(message: NStream.NStocks.IQuote, cb: any) {
    let key = `${message.ev}-${message.sym}`
    logger.log('silly', `Updating ${key}-${message.t}`)
    async.auto({
      bid: (autoCallback) => {
        this.client.zadd(`${key}-bid`, message.bs, message.bp, autoCallback)
        this.client.expire(`${key}-bid`, 86400)
      },
      ask: (autoCallback) => {
        // console.log([`${message.ev}-${message.sym}-${message.ap}-ask`, `${message.as}`, 'EX', '86400'])
        this.client.zadd(`${key}-ask`, message.as, message.ap, autoCallback)
        this.client.expire(`${key}-ask`, 86400)
      }
    }, ASYNC_LIMIT, cb)
  }

  // Old way, using a key for each price
  // updateQuoteBook(message: NStream.NStocks.IQuote, cb: any) {
  //   logger.log('silly', `Updating ${message.ev}-${message.sym}-${message.t}`)
  //   async.auto({
  //     bid: (autoCallback) => {
  //       // console.log([`${message.ev}-${message.sym}-${message.bp}-bid`, `${message.bs}`, 'EX', '86400'])
  //       this.client.set([`${message.ev}-${message.sym}-${message.bp}-bid`, `${message.bs}`, 'EX', '86400'], autoCallback)
  //     },
  //     ask: (autoCallback) => {
  //       // console.log([`${message.ev}-${message.sym}-${message.ap}-ask`, `${message.as}`, 'EX', '86400'])
  //       this.client.set([`${message.ev}-${message.sym}-${message.ap}-ask`, `${message.as}`, 'EX', '86400'], autoCallback)
  //     }
  //   }, ASYNC_LIMIT, (err) => {
  //     // if (err) {
  //     //   throw err;
  //     //   process.exit(1)
  //     // }
  //     cb(err)
  //   })
  // }

  updateQuoteBookWithTrade(message: NStream.NStocks.ITrade, cb: any) {
    logger.log('silly', `Updating ${message.ev}-${message.sym}-${message.p}-${message.s}`)
    let key = `${message.ev}-${message.sym}`
    logger.log('silly', `Updating ${key}-${message.t}`)
    async.auto({
      bid: (autoCallback) => {
        this.client.ZINCRBY(`${key}-bid`, message.s * -1, message.p, autoCallback)
        this.client.expire(`${key}-bid`, 86400)
      },
      ask: (autoCallback) => {
        // console.log([`${message.ev}-${message.sym}-${message.ap}-ask`, `${message.as}`, 'EX', '86400'])
        this.client.ZINCRBY(`${key}-ask`, message.s * -1, message.p, autoCallback)
        this.client.expire(`${key}-ask`, 86400)
      }
    }, ASYNC_LIMIT, cb)
  }

  ackStreamMessage(streamName: string, id: string, cb: Function) {
    this.client.xack(streamName, this.streamGroup, id, cb)
  }

}
