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


export default class Quant {
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

    // this.redis.getAssetList((err: any, assets: string[]) => {
    //   if(err) {
    //     logger.error(err)
    //   } else {
    //     this.assets = assets
    //     this.startAnalysis()
    //   }
    // })
    this.runAnalysis('1D', ['AAPL'])
  }

  private startAnalysis() {
    logger.log('info', "Starting Analysis Crons")
    this.cronJobs.analysis1D = new CronJob('0 23 * * *', () => {
      this.runAnalysis('1D')
    }, null, true, MARKET_TIMEZONE);
    this.cronJobs.analysis1D.start();
    logger.log('info', "Started 1D Analysis Cron")

    // this.cronJobs.analysis15Min = new CronJob('0 0 * * *', () => {
    //   this.runAnalysis('15Min')
    // }, null, true, MARKET_TIMEZONE);
    // this.cronJobs.analysis15Min.start();
    // logger.log('info', "Started 15Min Analysis Cron")

    // this.cronJobs.analysis5Min = new CronJob('*/15 * * * *', () => {
    //   this.runAnalysis('5Min')
    // }, null, true, MARKET_TIMEZONE);
    // this.cronJobs.analysis5Min.start();
    // logger.log('info', "Started 5Min Analysis Cron")

    // this.cronJobs.analysis1Min = new CronJob('*/5 * * * *', () => {
    //   this.runAnalysis('1Min')
    // }, null, true, MARKET_TIMEZONE);
    // this.cronJobs.analysis1Min.start();
    // logger.log('info', "Started 1Min Analysis Cron")

    this.runAnalysis('1D')
  }

  runAnalysis(timeframe: string, assets?: string[]) {

    assets = assets ? assets : this.assets
    // https://www.visualcapitalist.com/12-types-technical-indicators-stocks/
    async.eachLimit(assets, ASYNC_LIMIT, (asset, eachCallback) => {
      logger.log('info', `Started ${timeframe} Analysis of ${asset}`)
      async.auto({
        data: (autoCallback) => {
          this.influx.queryMarketData(asset, 'volume', timeframe, moment().subtract(1, 'year').format(), moment().format(), true, autoCallback)
        },
        trend: ['data', (results:any, autoCallback) => { this.trend(results.data, autoCallback) }],
        momentum: ['data', (results:any, autoCallback) => { this.momentum(results.data, autoCallback) }],
        volatility: ['data', (results:any, autoCallback) => { this.volatility(results.data, autoCallback) }],
        volume: ['data', (results:any, autoCallback) => { this.volume(results.data, autoCallback) }],
      }, (err: any, results: any) => {
					console.log(results.volatility)
          eachCallback(err)
        })
      }, (err) => {
        if(err) {
          logger.error(err)
        }
        process.exit()
      })
  }

  trend(data: any, cb: any) {
    async.auto({
      EMA: (autoCallback) => {
        /* Exponential Moving Average
          Lagging Indicator
          Used to identify trends and reversals, as well as to set up support
          and resistance levels.
        */
        // https://www.investopedia.com/terms/e/ema.asp

        const periods = [12, 26]

        async.map(periods, (period, mapCallback) => {
          tulind.indicators.ema.indicator([data.close], [period], (err, output) => {
            let o = {}
            o[period] = _.first(output)
            mapCallback(err, o)
          });
        }, autoCallback)
      },
      SMA: (autoCallback) => {
        /* Simple Moving Average
          Lagging Indicator
          Used to identify trends and reversals, as well as to set up support
          and resistance levels.
        */
        // https://www.investopedia.com/terms/s/sma.asp

        const periods = [5, 30, 50, 200]

        async.map(periods, (period, mapCallback) => {
          tulind.indicators.sma.indicator([data.close], [period], (err, output) => {
            let o = {}
            o[period] = _.first(output)
            mapCallback(err, o)
          });
        }, autoCallback)
      },
      MACD: (autoCallback) => {
        /* Moving Average Convergence Divergence (MACD)
          Lagging Indicator
          Used to reveal changes in the strength, direction, momentum, and duration of a trend in a stock’s price.
        */
        // https://www.investopedia.com/terms/m/macd.asp
        const options = [
          12, // short period
          26, // long period
          9  // signal period
        ]
        async.auto({
          macdClose: (macdAutoCallback) => {
            tulind.indicators.macd.indicator([data.close], options, (err, output) => {
              if(err) {
                macdAutoCallback(err)
              } else {
                macdAutoCallback(err, {
                  macd: output[0],
                  macd_signal: output[1],
                  macd_histogram: output[2],
                })
              }
            });
          },
        }, autoCallback)
      },
      PSAR: (autoCallback) => {
        /* Parabolic Stop and Reverse (Parabolic SAR)
          Leading Indicator
          Used to find potential reversals in the market price direction.
        */
        // https://www.investopedia.com/terms/p/parabolicindicator.asp
        const options = [
          .02,  // acceleration factor step
          .2,   // acceleration factor maximum
        ]
        tulind.indicators.psar.indicator([data.high, data.low], options, (err, output) => {
          if (err) {
            autoCallback(err)
          } else {
            autoCallback(err, _.first(output))
          }
        });
      },
    }, cb)
  }

  momentum(data: any, cb: any) {
    async.auto({
      stoch: (autoCallback) => {
        /* Stochastic Oscillator
          Leading Indicator
          Used to predict price turning points by comparing the closing price to its price range.
        */
        // https://www.investopedia.com/terms/s/stochasticoscillator.asp
        const options = [
          14, // %k period
          14, // %k slowing period
          3, // %d period
        ]
        tulind.indicators.stoch.indicator([
            data.high,
            data.low,
            data.close,
          ], options, (err, output) => {
          if (err) {
            autoCallback(err)
          } else {
            autoCallback(err, {
              stoch_k: output[0],
              stoch_d: output[1],
            })
          }
        });
      },
      CCI: (autoCallback) => {
        /* Commodity Channel Index (CCI)
          Leading Indicator
          An oscillator that helps identify price reversals, price extremes, and trend strength.
        */
        // https://www.investopedia.com/terms/c/commoditychannelindex.asp
        const options = [
          20, // period
        ]
        tulind.indicators.cci.indicator([
          data.high,
          data.low,
          data.close,
        ], options, (err, output) => {
          if (err) {
            autoCallback(err)
          } else {
            autoCallback(err, _.first(output))
          }
        });
      },
      RSI: (autoCallback) => {
        /* Relative Strength Index (RSI)
          Leading Indicator
          Measures recent trading strength, velocity of change in the trend, and magnitude of the move.
        */
        // https://www.investopedia.com/terms/r/rsi.asp#what-is-relative-strength-index--rsi
        const options = [
          14, // period
        ]
        tulind.indicators.rsi.indicator([
          data.close,
        ], options, (err, output) => {
          if (err) {
            autoCallback(err)
          } else {
            autoCallback(err, _.first(output))
          }
        });
      },
    }, cb)
  }

	volatility(data: any, cb: any) {
		async.auto({
			bbands: (autoCallback) => {
        /* Bollinger bands
          Lagging Indicator
          Measures the “highness” or “lowness” of price, relative to previous trades.
        */
        // https://www.investopedia.com/terms/b/bollingerbands.asp
				const options = [
					20, // period
					2, // stddev
				]
				tulind.indicators.bbands.indicator([
					data.close,
				], options, (err, output) => {
					if (err) {
						autoCallback(err)
					} else {
						autoCallback(err, {
							lower: output[0],
							middle: output[1],
							upper: output[2],
						})
					}
				});
			},
		}, cb)
	}

  volume(data: any, cb: any) { cb() }
}
