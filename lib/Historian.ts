/// <reference path="../typings/index.d.ts"/>

import _ from 'lodash'
import async from 'async'
import Alpaca from './Alpaca'
import Influx from './Influx'
import Redis from './Redis'

const ASYNC_LIMIT = 10

const ALPACA_SYMBOL_LIMIT = 200
const INFLUX_WRITE_LIMIT = 5000 //5000-10000
const ALPACA_BAR_LIMIT = INFLUX_WRITE_LIMIT / ALPACA_SYMBOL_LIMIT

import Logger from "./Logger"
const logger = new Logger("Historian")
const CronJob = require('cron').CronJob;

const MARKET_TIMEZONE = 'America/New_York'

export default class Historian {
  private alpaca: any
  private influx: Influx
  private redis: Redis

  private cronJobs: any
  public symbols: string[]

  constructor(a: Alpaca, i: Influx, r: Redis) {
    this.alpaca = a
    this.influx = i
    this.redis = r
    this.cronJobs = {}
    this.symbols = []

    this.cronJobs.fetchAssets = new CronJob('0 0 * * *', () => {
      this.fetchAssets()
    }, null, true, MARKET_TIMEZONE);
    this.cronJobs.fetchAssets.start();

    this.fetchAssets()
  }

  private fetchAssets() {
    logger.log('info', "Fetch Assets Starting")
    this.alpaca.getAllAssets((err: any, assets: IAsset[]) => {
      if (err) {
        logger.log('error', err)
      } else {
        async.each(assets, (asset: IAsset, eachCallback: async.ErrorCallback) => {
          this.redis.storeAsset(asset, eachCallback)
        },(err) => {
          if(err) {
            logger.log('error', err)
          } else {
            logger.log('info', `${assets.length} Assets Stored`)
            this.symbols = _.map(assets, 'symbol')
            // this.symbols = _.map(_.filter(assets, { tradable: true } as any), 'symbol')
            this.startBarFetching()
          }
        })
      }
    })
  }

  private startBarFetching() {
    logger.log('info', "Starting Bar Fetching")
    this.cronJobs.fetchBars1D = new CronJob('0 23 * * *', () => {
      this.fetchBars('1D', ALPACA_BAR_LIMIT)
    }, null, true, MARKET_TIMEZONE);
    this.cronJobs.fetchBars1D.start();
    logger.log('info', "Started 1D Bar Cron")

    this.cronJobs.fetchBars15Min = new CronJob('0 0 * * *', () => {
      this.fetchBars('15Min', ALPACA_BAR_LIMIT)
    }, null, true, MARKET_TIMEZONE);
    this.cronJobs.fetchBars15Min.start();
    logger.log('info', "Started 15Min Bar Cron")

    this.cronJobs.fetchBars5Min = new CronJob('*/15 * * * *', () => {
      this.fetchBars('5Min', ALPACA_BAR_LIMIT)
    }, null, true, MARKET_TIMEZONE);
    this.cronJobs.fetchBars5Min.start();
    logger.log('info', "Started 5Min Bar Cron")

    this.cronJobs.fetchBars1Min = new CronJob('*/5 * * * *', () => {
      this.fetchBars('1Min', ALPACA_BAR_LIMIT)
    }, null, true, MARKET_TIMEZONE);
    this.cronJobs.fetchBars1Min.start();
    logger.log('info', "Started 1Min Bar Cron")

    this.fetchBars('1D', ALPACA_BAR_LIMIT)
  }

  private fetchBars(timeframe: string, limit: number) {
    const symbolChunks: string[][] = _.chunk(this.symbols, ALPACA_SYMBOL_LIMIT)
    async.eachLimit(symbolChunks, ASYNC_LIMIT, (chunk: string[], eachCallback: async.ErrorCallback) => {
      async.auto({
        getBars: (autoCallback: async.ErrorCallback) => {
          logger.log('debug', `${timeframe} for ${chunk.length} symbols`)
          this.alpaca.getBars(timeframe, chunk, {
            limit
          }, autoCallback)
        },
        storeBars: ['getBars', (results: any, autoCallback: async.ErrorCallback) => {
          const bars = _.flatten(_.map(results.getBars, (bars: IBar[], symbol: string) => {
            return _.map(bars, (b: IAssetBar) => {
              b.symbol = symbol
              b.timeframe = timeframe
              return b
            })
          }))
          const lines = _.map(bars, (bar: IAssetBar) => {
            return this.influx.getLine(bar.symbol, {
              timeframe: bar.timeframe
            }, {
              open: bar.o,
              high: bar.h,
              low: bar.o,
              close: bar.c,
              volume: bar.v
            }, bar.t)
          })

          if(lines.length > 0) {
            this.influx.batchWrite(lines, autoCallback)
          } else {
            logger.log('warn', `No data to write, skipping Influx load.`)
            autoCallback()
          }
        }]
      }, ASYNC_LIMIT, eachCallback)
    }, (err: any) => {
      if (err) {
        logger.log('error', err)
      } else {
        logger.log('info', `${timeframe} Bar Fetch complete`)
      }
    })
  }
}