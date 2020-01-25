/// <reference path="../typings/index.d.ts"/>

import async from 'async'
import Alpaca from './Alpaca'
import Redis from './Redis'

const ASYNC_LIMIT = 10
const ASSET_INTERVAL = 3600000

import Logger from "./Logger"
const logger = new Logger("Historian")

export default class Historian {
  alpaca: any
  redis: Redis
  fetchAssetInterval: any

  constructor(a: Alpaca, r: Redis) {
    this.alpaca = a
    this.redis = r
    logger.log('info', "Fetch Assets Starting")
    this.fetchAssetInterval = setInterval(this.fetchAssets, ASSET_INTERVAL) //Hourly check
    logger.log('info', "Fetch Assets Started")
    this.fetchAssets()
  }

  private fetchAssets() {
    async.auto({
      assets: (autoCallback: async.ErrorCallback) => {
        logger.log('info', "Fetching Assets")
        this.alpaca.getAllAssets(autoCallback)
      },
      queueAssets: ['assets', (results: any, autoCallback: Function) => {
        logger.log('info', "Queuing Assets")
        async.eachLimit(results.assets, ASYNC_LIMIT, (asset: IAsset, eachCallback: async.ErrorCallback) => {
          logger.log('debug', `Queuing Asset ${asset.symbol}`)
          this.redis.queueObj('assets', asset, eachCallback)
        }, autoCallback as async.ErrorCallback)
      }]
    }, ASYNC_LIMIT, (err: any, results: any) => {
      if(err) {
        logger.log('error', err)
      } else {
        logger.log('info', "Processing Assets")
        this.processAssets()
      }
    })
  }

  private processAssets() {

  }
}