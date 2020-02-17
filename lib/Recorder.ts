/// <reference path='../typings/index.d.ts'/>

import _ from 'lodash'
import async from 'async'

import Alpaca from './Alpaca'
import Influx from './Influx'
import Redis from './Redis'

const ASYNC_LIMIT = 10

const ALPACA_SYMBOL_LIMIT = 200
const INFLUX_WRITE_LIMIT = 5000 //5000-10000
const ALPACA_BAR_LIMIT = INFLUX_WRITE_LIMIT / ALPACA_SYMBOL_LIMIT

import Logger from './Logger'
const logger = new Logger('Recorder')
const CronJob = require('cron').CronJob;

const MARKET_TIMEZONE = 'America/New_York'

export default class Recorder {
  private alpaca: any
  private alpacaClient: any
  private influx: Influx
  private redis: Redis

  private cronJobs: any
  // public assets: string[]
  private feeds: string[]

  constructor(a: Alpaca, i: Influx, r: Redis) {
    this.alpaca = a
    this.influx = i
    this.redis = r
    this.feeds = [
      'trade_updates',
      'account_updates',
      'T.*',
      'Q.*',
      'A.*',
      'AM.*',
    ]

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
      logger.log("debug", `Stock trades: ${subject}, ${data}`)
    })
    this.alpaca.websocket.onStockQuotes((subject, data) => {
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
