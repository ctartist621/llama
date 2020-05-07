/// <reference path='../typings/index.d.ts'/>

import _ from 'lodash'
import async from 'async'

import needle from 'needle'
import Redis from './Redis'

const ASYNC_LIMIT = 10

import Logger from './Logger'
const logger = new Logger('Crypto Recorder')


const WebSocket = require('ws');

export default class CryptoRecorder {
  private redis: Redis
  private coinbaseFeed: any

  private cronJobs: any

  constructor(r: Redis) {
    this.redis = r

    this.coinbaseFeed = new WebSocket('wss://ws-feed.pro.coinbase.com');

    needle.get('https://api.gdax.com//products', (err, products) => {
      if (err) {
        throw err;
      } else {
        console.log(products)
        console.log(_.map(products.body, 'id'))
        this.coinbaseFeed.on('open', () => {
          console.log("Websocket opened")
          this.coinbaseFeed.send(JSON.stringify({
            "type": "subscribe",
            "product_ids": _.map(products.body, 'id'),
            "channels": [
              "level2",
              "heartbeat",
              {
                "name": "ticker",
                "product_ids": _.map(products.body, 'id')
              }
            ]
          }))
        })
      }
    })

    this.coinbaseFeed.on('close', () => {
      console.log("Websocket disconected")
    })

    this.coinbaseFeed.on('message', (data) => {
      let d = data
      this.redis.storeStreamMessage('cryptoMarketData',data)
      logger.log('silly', data)
    })


    setInterval(() => {
      const used = process.memoryUsage().heapUsed / 1024 / 1024;
      logger.log("debug", `Recorder uses approximately ${Math.round(used * 100) / 100} MB`);
    }, 1000)

  }
}
