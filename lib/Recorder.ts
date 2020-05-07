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

  constructor(a: Alpaca, r: Redis) {
    this.alpaca = a
    this.redis = r
    this.feeds = [
      'trade_updates',
      'account_updates',
      'T.*',
      'Q.*',
      'A.*',
      'AM.*',
    ]

    setInterval(() => {
      const used = process.memoryUsage().heapUsed / 1024 / 1024;
      logger.log("info", `Recorder uses approximately ${Math.round(used * 100) / 100} MB`);
      // heapdump.writeSnapshot()
    }, 1000)

    this.alpaca.websocket.connect()

    this.alpaca.websocket.onConnect(() => {
      logger.log("debug", "Connected")
      logger.log("debug", `Subscribing to ${this.feeds}`)
      this.alpaca.websocket.subscribe(this.feeds)
    })
    this.alpaca.websocket.onDisconnect(() => {
      logger.log("debug", "Disconnected")
      // process.exit()
      this.alpaca.websocket.connect()
    })
    this.alpaca.websocket.onStateChange(newState => {
      logger.log("debug", `State changed to ${newState}`)
    })
    this.alpaca.websocket.onOrderUpdate(data => {
      logger.log("debug", `Order updates: ${JSON.stringify(data)}`)
    })
    this.alpaca.websocket.onAccountUpdate(data => {
      logger.log("debug", `Account updates: ${JSON.stringify(data)}`)
    })
    this.alpaca.websocket.onStockTrades((subject, data) => {
      this.redis.storeStreamMessage('stockMarketData', data)
      logger.log("debug", `Stock trades: ${subject}, ${data}`)
    })
    this.alpaca.websocket.onStockQuotes((subject, data) => {
      this.redis.storeStreamMessage('stockMarketData', data)
      logger.log("debug", `Stock quotes: ${subject}, ${data}`)
    })
    this.alpaca.websocket.onStockAggSec((subject, data) => {
      logger.log("debug", `Stock agg sec: ${subject}, ${data}`)
    })
    this.alpaca.websocket.onStockAggMin((subject, data) => {
      logger.log("debug", `Stock agg min: ${subject}, ${data}`)
    })
  }
}
