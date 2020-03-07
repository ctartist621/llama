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

export default class Quant {
  alpaca: any
  influx: Influx
  redis: Redis
  indicatorOptions: any

  assets: string[]
  private cronJobs: any


  constructor(a: Alpaca, i: Influx, r: Redis) {
    this.alpaca = a
    this.influx = i
    this.redis = r
    this.assets = []
    this.cronJobs = {}

    if (fs.existsSync(OPTIONS_PATH)) {
      this.indicatorOptions = JSON.parse(fs.readFileSync(OPTIONS_PATH).toString())
    } else {
      logger.error(`Quant could not be started.  Indicator Options does not exist.`)
      process.exit(1)
    }

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

    this.cronJobs.analysis15Min = new CronJob('0 21 * * MON-FRI', () => {
      this.runAnalysis('15Min')
    }, null, true, MARKET_TIMEZONE);
    this.cronJobs.analysis15Min.start();
    logger.log('info', "Started 15Min Analysis Cron")

    this.cronJobs.analysis5Min = new CronJob('*/7 7-19 * * MON-FRI', () => {
      this.runAnalysis('5Min')
    }, null, true, MARKET_TIMEZONE);
    this.cronJobs.analysis5Min.start();
    logger.log('info', "Started 5Min Analysis Cron")

    this.cronJobs.analysis1Min = new CronJob('*/3 7-19 * * MON-FRI', () => {
      this.runAnalysis('1Min')
    }, null, true, MARKET_TIMEZONE);
    this.cronJobs.analysis1Min.start();
    logger.log('info', "Started 1Min Analysis Cron")

    this.runAnalysis('1D')
  }

  runAnalysis(timeframe: string, assets?: string[]) {

    assets = assets ? assets : this.assets
    // https://www.visualcapitalist.com/12-types-technical-indicators-stocks/
    async.eachLimit(assets, ASYNC_LIMIT, (asset, eachAssetCallback) => {
      logger.log('info', `Started ${timeframe} Analysis of ${asset}`)
      async.auto({
        data: (autoCallback) => {
          this.influx.queryMarketData(asset, timeframe, moment().subtract(1, 'year').format(), moment().format(), true, autoCallback)
        },
        tulindIndicators: ['data', (results: any, autoCallback) => {
          if (_.isEmpty(results.data)) {
            logger.log('warn', `No Data for ${asset}`)
            autoCallback()
          } else {
            this.tulindIndicators(results.data, autoCallback)
          }
        }],
        customIndicators: ['data', (results: any, autoCallback) => {
          if (_.isEmpty(results.data)) {
            logger.log('warn', `No Data for ${asset}`)
            autoCallback()
          } else {
            this.customIndicators(asset, results.data, autoCallback)
          }
        }],
        storeTulindIndicators: ['tulindIndicators', (results: any, autoCallback) => {
          let lines: any[] = []
          async.forEachOfLimit(results.tulindIndicators, ASYNC_LIMIT, (indicatorData: any, indicatorName: any, eachIndicatorCallback: any) => {
            for (var i = _.keys(indicatorData).length - 1; i >= 0; i--) {
              for (var j = results.data.time.length - 1; j >= 0; j--) {
                if (_.isFinite(indicatorData[_.keys(indicatorData)[i]][j])) {
                  lines.push(this.influx.getLine(asset, {
                    indicator: indicatorName,
                    output: _.keys(indicatorData)[i],
                    timeframe,
                  }, {
                    indicator: indicatorData[_.keys(indicatorData)[i]][j],
                  }, moment(results.data.time[j]).unix()))
                }
              }
            }
            if (lines.length > 0) {
              this.influx.batchWrite('indicators', lines, (err, ret) => {
                if (err) {
                  logger.log('error', err)
                } else {
                  logger.log('debug', `Indicators stored for ${asset}`)
                }
                eachIndicatorCallback(err)
              })
            } else {
              logger.log('debug', `No data to write, skipping Influx load.`)
              eachIndicatorCallback()
            }
          }, autoCallback)
        }],
      }, (err: any, results: any) => {
          logger.log('info', `${timeframe} Analysis for ${asset} Complete`)
          eachAssetCallback(err)
      })
    }, (err) => {
      if (err) {
        logger.error(err)
      } else {
        logger.log('info', `${timeframe} Analysis Complete`)
      }
    })
  }

  indicators(data: any, cb: any) {
    let calculatedIndicators = {}
    async.eachOf(this.indicatorOptions, (opts: any, indicatorName: any, eachCallback: any) => {
      if (opts.configured) {
        const inputs = _.map(opts.indicator.input_names, (i: string) => {
          return data[i = 'real' ? 'close' : i]
        })
        const options = _.map(opts.indicator.option_names, (i: string) => {
          return opts[i]
        })
        tulind.indicators[opts.indicator.name].indicator(inputs, options, (err: any, outputs: any[]) => {
          if (err) {
            eachCallback(err)
          } else {
            let calculatedIndicator = {}
            for (var i = opts.indicator.output_names.length - 1; i >= 0; i--) {
              calculatedIndicator[opts.indicator.output_names[i]] = outputs[i]
            }
            calculatedIndicators[indicatorName] = calculatedIndicator
            eachCallback()
          }
        })
      } else {
        logger.log('debug', `Skipping ${opts.indicator.full_name}, not configured.`)
        eachCallback()
      }
    }, (err: any) => {
      cb(err, calculatedIndicators)
    })
  }

  customIndicators(asset: string, data: any, cb: any) {
    let d: any[] = []
    for (var i = data.time.length - 1; i >= 0; i--) {
      d.push({
        l: data.low[i],
        h: data.high[i],
        p: data.open[i],
        c: data.close[i],
        v: data.volume[i],
        t: data.time[i],
      })
    }
    async.auto({
      ulcerIndex: (autoCallback) => {
        const PERIOD = 14
        for (var i = 0; i < d.length - PERIOD; ++i) {
          const window = _.slice(d, i, i + PERIOD)
          if (window.length == 14) {
            const maxClose = _.maxBy(window, (b) => { return b.c }).c
            let percentDrawdown: number[] = []
            for (var j = 0; j < window.length; ++j) {
              percentDrawdown.push(100*(window[j].c-maxClose)/maxClose)
            }
            const sumR = _.reduce(percentDrawdown, (sum, r) => {
              return sum + Math.pow(r,2)
            }, 0)
            d[i].ui = Math.sqrt(sumR/PERIOD)
          } else {
            // End of usable data
          }
        }

        process.exit()
        autoCallback()
      }
    }, cb)
  }

  static get optionsPath(): string {
    return OPTIONS_PATH
  }

  static generateOptionsTemplate(cb) {
    async.transform(tulind.indicators, (obj: any, indicator: any, name: string, transformCallback: any) => {
      let options = {
        configured: false,
        indicator
      }
      if (indicator.options == 0) {
        options.configured = true
      } else {
        _.each(indicator.option_names, (n) => {
          options[n] = null
        })
      }
      obj[name] = options
      transformCallback()
    }, (err, ret) => {
      if (err) {
        cb(err)
      } else {
        logger.log('info', `Options json write to ${this.optionsPath}`)
        fs.writeFile(this.optionsPath, JSON.stringify(ret, null, 2), cb)
      }
    })
  }
}
