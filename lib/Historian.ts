/// <reference path="../typings/index.d.ts"/>

import _ from 'lodash'
import async from 'async'
import Alpaca from './Alpaca'
import Influx from './Influx'
import Redis from './Redis'

const ASYNC_LIMIT = 10
const ASSET_INTERVAL = 3600000

import Logger from "./Logger"
const logger = new Logger("Historian")

export default class Historian {
  alpaca: any
  influx: Influx
  redis: Redis

  fetchAssetInterval: any
  assetQueue: any
  barQueue: any

  constructor(a: Alpaca, i: Influx, r: Redis) {
    this.alpaca = a
    this.influx = i
    this.redis = r

    this.assetQueue = async.queue((asset: IAsset, callback: async.ErrorCallback) => { this.processAsset(asset, callback) }, ASYNC_LIMIT)
    this.barQueue = async.queue((bar: IAssetBar, callback: async.ErrorCallback) => { this.processBar(bar, callback) }, ASYNC_LIMIT)

    this.assetQueue.drain(function() {
      logger.log('info', 'all items have been processed');
      process.exit()
    })

    this.assetQueue.error(function(err, task) {
      console.error('task experienced an error', err, task);
    })

    logger.log('info', "Fetch Assets Starting")
    this.fetchAssetInterval = setInterval(this.fetchAssets, ASSET_INTERVAL) //Hourly check
    logger.log('info', "Fetch Assets Started")

    this.fetchAssets()
  }

  private fetchAssets() {
    logger.log('info', "Fetching Assets")
    this.alpaca.getAllAssets((err, assets) => {
      if (err) {
        logger.log('error', err)
      } else {
        this.assetQueue.push(assets)
        logger.log('info', `Asset fetch complete. ${assets.length} assets queued.`)
      }
    })
  }

  private processAsset(asset: IAsset, cb: async.ErrorCallback) {
    async.auto({
      storeAsset: (autoCallback: async.ErrorCallback) => {
        logger.log('debug', `Storing Asset ${asset.symbol}`)
        this.redis.storeAsset(asset, autoCallback)
      },
      bars_1D: (autoCallback: async.ErrorCallback) => {
        if(asset.tradable) {
          const timeframe = '1D'
          logger.log('debug', `Retrieving 1D bars for ${asset.symbol}`)
          this.alpaca.getBars(timeframe, asset.symbol, {}, (err, bars: IBar[]) => {
            if (err) {
              autoCallback(err)
            } else {
              let assetBars = _.map(bars, (b: IAssetBar) => {
                b.symbol = asset.symbol
                b.timeframe = timeframe
                return b
              })
              this.barQueue.push(assetBars)
              autoCallback()
            }
          })
        } else {
          logger.log('info', `Not retrieving bars for untradable Asset ${asset.symbol}`)
          autoCallback()
        }
      },
    }, cb)
  }

  processBar(bar: IAssetBar, cb: async.ErrorCallback) {
    this.influx.write(bar.symbol, {
      timeframe: bar.timeframe
    }, {
      open: bar.o,
      high: bar.h,
      low: bar.o,
      close: bar.c,
      volume: bar.v
    }, bar.t, cb)
  }
}