/// <reference path="../typings/index.d.ts"/>

import _ from 'lodash'
import async from 'async'
import Alpaca from './Alpaca'
import Influx from './Influx'
import Redis from './Redis'

import moment from 'moment'
import tulind from 'tulind'

import fs = require('fs')
const ASYNC_LIMIT = 10
const ASSET_INTERVAL = 3600000

const CronJob = require('cron').CronJob;

import Logger from "./Logger"
const logger = new Logger("Quant")

const MARKET_TIMEZONE = 'America/New_York'

const OPTIONS_PATH = './config/indicatorOptions.json'

export default class Broker {
  alpaca: any
  influx: Influx
  redis: Redis

  assets: string[]
  private cronJobs: any

  constructor(a: Alpaca, i: Influx, r: Redis) {
    this.alpaca = a
    this.influx = i
    this.redis = r
    this.assets = []
    this.cronJobs = {}

    this.redis.getAssetList((err: any, assets: string[]) => {
      if(err) {
        logger.error(err)
      } else {
        this.assets = assets
        this.startAnalysis()
      }
    })
  }

  private startAnalysis() {
    logger.log('info', "Starting Analysis Crons")
    this.cronJobs.analysis1D = new CronJob('0 22 * * *', () => {
      this.runAnalysis('1D')
    }, null, true, MARKET_TIMEZONE);
    this.cronJobs.analysis1D.start();
    logger.log('info', "Started 1D Analysis Cron")

    // this.cronJobs.analysis15Min = new CronJob('0 21 * * MON-FRI', () => {
    //   this.runAnalysis('15Min')
    // }, null, true, MARKET_TIMEZONE);
    // this.cronJobs.analysis15Min.start();
    // logger.log('info', "Started 15Min Analysis Cron")

    // this.cronJobs.analysis5Min = new CronJob('*/7 7-19 * * MON-FRI', () => {
    //   this.runAnalysis('5Min')
    // }, null, true, MARKET_TIMEZONE);
    // this.cronJobs.analysis5Min.start();
    // logger.log('info', "Started 5Min Analysis Cron")

    // this.cronJobs.analysis1Min = new CronJob('*/3 7-19 * * MON-FRI', () => {
    //   this.runAnalysis('1Min')
    // }, null, true, MARKET_TIMEZONE);
    // this.cronJobs.analysis1Min.start();
    // logger.log('info', "Started 1Min Analysis Cron")

    this.runAnalysis('1D')
  }


  // Get indicators, determine buy / sell / hold, determine position enter / exit price and volume
  runAnalysis(timeframe: string, assets?: string[]) {
    async.eachLimit(this.assets, ASYNC_LIMIT, (asset, eachCallback) => {
      this.influx.getIndicatorDerivatives(asset, timeframe, (err, results) => {
        console.log(results)
        eachCallback(err)
      })
    }, (err) => {
      if(err) {
        logger.log('error', err)
      }
    })
  }
}
