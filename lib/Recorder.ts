/// <reference path='../typings/index.d.ts'/>

import _ from 'lodash'
import async from 'async'

import Alpaca from './Alpaca'
import Redis from './Redis'

const heapdump = require("heapdump")

const ASYNC_LIMIT = 10

import Logger from './Logger'
const logger = new Logger('Recorder')

export default class Recorder {
  private alpaca: any
  private alpacaClient: any
  private redis: Redis

  private cronJobs: any
  // public assets: string[]
  private feeds: string[]

  constructor(a: Alpaca, r: Redis, subscription: string) {
    this.alpaca = a
    this.redis = r

    this.feeds = [
      // 'trade_updates',
      // 'account_updates',
      'T.ACB',
      'Q.ACB',
      // 'T.*',
      // 'Q.*',
      // 'A.*',
      // 'AM.*',
    ]

    switch (subscription) {
      case "value":
        // code...
        break;

      default:
        // code...
        break;
    }

    setInterval(() => {
      const used = process.memoryUsage().heapUsed / 1024 / 1024;
      logger.log("info", `Recorder uses approximately ${Math.round(used * 100) / 100} MB`);
      // heapdump.writeSnapshot()
    }, 1000)

    this.alpaca.data_ws.connect()

    this.alpaca.data_ws.onConnect(() => {
      logger.log("debug", "Connected")
      logger.log("debug", `Subscribing to ${this.feeds}`)
      this.alpaca.data_ws.subscribe(this.feeds)
    })
    this.alpaca.data_ws.onDisconnect(() => {
      logger.log("debug", "Disconnected")
      // process.exit()
      this.alpaca.data_ws.connect()
    })
    this.alpaca.data_ws.onStateChange(newState => {
      logger.log("debug", `State changed to ${newState}`)
    })
    this.alpaca.data_ws.onOrderUpdate(data => {
      logger.log("debug", `Order updates: ${JSON.stringify(data)}`)
    })
    this.alpaca.data_ws.onAccountUpdate(data => {
      logger.log("debug", `Account updates: ${JSON.stringify(data)}`)
    })
    this.alpaca.data_ws.onStockTrades((subject, data) => {
      this.redis.storeStreamMessage('stockMarketData', data)
      logger.log("silly", `Stock trades: ${subject}, ${data}`)
    })
    this.alpaca.data_ws.onStockQuotes((subject, data) => {
      this.redis.storeStreamMessage('stockMarketData', data)
      logger.log("silly", `Stock quotes: ${subject}, ${data}`)
    })
    this.alpaca.data_ws.onStockAggSec((subject, data) => {
      logger.log("debug", `Stock agg sec: ${subject}, ${data}`)
    })
    this.alpaca.data_ws.onStockAggMin((subject, data) => {
      logger.log("debug", `Stock agg min: ${subject}, ${data}`)
    })
  }
}
