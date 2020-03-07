/// <reference path='../typings/index.d.ts'/>

import _ from 'lodash'
import async from 'async'

import Alpaca from './Alpaca'
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

    this.coinbaseFeed.on('open', () => {
      console.log("Websocket opened")
      this.coinbaseFeed.send(JSON.stringify({
        "type": "subscribe",
        "product_ids": [
          "ETH-USD",
          "ETH-EUR"
        ],
        "channels": [
          "level2",
          "heartbeat",
          {
            "name": "ticker",
            "product_ids": [
              "ETH-BTC",
              "ETH-USD"
            ]
          }
        ]
      }))
    })

    this.coinbaseFeed.on('close', () => {
      console.log("Websocket disconected")
    })

    this.coinbaseFeed.on('message', function incoming(data) {
      console.log('message');
      console.log(data);
    })


    setInterval(() => {
      const used = process.memoryUsage().heapUsed / 1024 / 1024;
      logger.log("debug", `Recorder uses approximately ${Math.round(used * 100) / 100} MB`);
    }, 1000)

  }
}
