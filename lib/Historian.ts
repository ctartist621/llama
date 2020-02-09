/// <reference path='../typings/index.d.ts'/>

import _ from 'lodash'
import async from 'async'

import { extract } from 'article-parser'
import moment from 'moment'
import Sentiment from 'sentiment'
const sentiment = new Sentiment()

import Alpaca from './Alpaca'
import Influx from './Influx'
import Redis from './Redis'

const ASYNC_LIMIT = 10

const ALPACA_SYMBOL_LIMIT = 200
const INFLUX_WRITE_LIMIT = 5000 //5000-10000
const ALPACA_BAR_LIMIT = INFLUX_WRITE_LIMIT / ALPACA_SYMBOL_LIMIT

const BACKFILL_SCALER = '10'
const BACKFILL_UNIT = 'years'
const BACKFILL_RANGE = `-${BACKFILL_SCALER}${_.first(BACKFILL_UNIT)}`

import Logger from './Logger'
const logger = new Logger('Historian')
const CronJob = require('cron').CronJob;

const MARKET_TIMEZONE = 'America/New_York'

export default class Historian {
  private alpaca: any
  private influx: Influx
  private redis: Redis

  private cronJobs: any
  public assets: string[]

  constructor(a: Alpaca, i: Influx, r: Redis) {
    this.alpaca = a
    this.influx = i
    this.redis = r
    this.cronJobs = {}
    this.assets = []

    this.cronJobs.fetchAssets = new CronJob('0 0 * * *', () => {
      this.fetchAssets()
    }, null, true, MARKET_TIMEZONE);
    this.cronJobs.fetchAssets.start();

    this.fetchAssets()
  }

  private fetchAssets() {
    logger.log('info', 'Fetch Assets Starting')
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
            // this.assets = _.map(assets, 'symbol')
            this.assets = _.map(_.filter(assets, { tradable: true } as any), 'symbol')
            logger.log('info', `Processing ${this.assets.length} Tradable Assets`)
            this.startDataFetching()
          }
        })
      }
    })
  }

  private startDataFetching() {
    this.cronJobs.fetchNews = new CronJob('0 22 * * * ', () => {
      this.getRawSentimentData()
    }, null, true, MARKET_TIMEZONE);

    this.cronJobs.fetchBars1D = new CronJob('0 21 * * MON-FRI', () => {
      this.fetchBars('1D', ALPACA_BAR_LIMIT)
    }, null, true, MARKET_TIMEZONE);

    this.cronJobs.fetchBars15Min = new CronJob('0 20 * * MON-FRI', () => {
      this.fetchBars('15Min', ALPACA_BAR_LIMIT)
    }, null, true, MARKET_TIMEZONE);

    this.cronJobs.fetchBars5Min = new CronJob('*/15 7-19 * * MON-FRI', () => {
      this.fetchBars('5Min', ALPACA_BAR_LIMIT)
    }, null, true, MARKET_TIMEZONE);

    this.cronJobs.fetchBars1Min = new CronJob('*/5 7-19 * * MON-FRI', () => {
      this.fetchBars('1Min', ALPACA_BAR_LIMIT)
    }, null, true, MARKET_TIMEZONE);

    this.cronJobs.backfillBars1D = new CronJob('0 23 * * FRI', () => {
      this.backfillBars('1D', ALPACA_BAR_LIMIT)
    }, null, true, MARKET_TIMEZONE);

    this.startCronJobs()

    // this.backfillBars('1D', ALPACA_BAR_LIMIT)
  }

  private stopCronJobs() {
    this.cronJobs.fetchNews.stop();
    logger.log('info', 'Stopped News Fetching Cron')

    this.cronJobs.fetchBars1D.stop();
    logger.log('info', 'Stopped 1D Bar Cron')

    this.cronJobs.fetchBars15Min.stop();
    logger.log('info', 'Stopped 15Min Bar Cron')

    this.cronJobs.fetchBars5Min.stop();
    logger.log('info', 'Stopped 5Min Bar Cron')

    this.cronJobs.fetchBars1Min.stop();
    logger.log('info', 'Stopped 1Min Bar Cron')

    this.cronJobs.backfillBars1D.stop();
    logger.log('info', 'Stopped 1D Bar Backfill Cron')
  }

  private startCronJobs() {
    logger.log('info', 'Starting News Fetching Cron')
    this.cronJobs.fetchNews.start();
    logger.log('info', 'Started News Fetching Cron')

    logger.log('info', 'Starting Bar Fetching')
    this.cronJobs.fetchBars1D.start();
    logger.log('info', 'Started 1D Bar Cron')

    this.cronJobs.fetchBars15Min.start();
    logger.log('info', 'Started 15Min Bar Cron')

    this.cronJobs.fetchBars5Min.start();
    logger.log('info', 'Started 5Min Bar Cron')

    this.cronJobs.fetchBars1Min.start();
    logger.log('info', 'Started 1Min Bar Cron')

    this.cronJobs.backfillBars1D.start();
    logger.log('info', 'Started 1D Bar Backfill Cron')
  }

  private backfillBars(timeframe: string, ALPACA_BAR_LIMIT) {
    this.stopCronJobs()
    let overallStartingBarTime: string
    logger.log('info', `Starting ${timeframe} Backfill`)
    const symbolChunks: string[][] = _.chunk(_.shuffle(this.assets), ALPACA_SYMBOL_LIMIT)

    const tf= {
      '1D': { constant: 1, unit: 'days' },
      '15Min': { constant: 15, unit: 'minutes' },
      '5Min': { constant: 5, unit: 'minutes' },
      '1Min': { constant: 1, unit: 'minutes' },
    }

    async.eachSeries(symbolChunks, (chunk: string[], eachChunkCallback: async.ErrorCallback) => {
      async.mapLimit(chunk, ASYNC_LIMIT, (asset: string, eachAssetCallback) => {
        this.influx.oldestBarTime(asset, timeframe, BACKFILL_RANGE, eachAssetCallback)
      }, (err: any, times: string[]|any) => {

        console.log(times)

        let timePointer = moment("1970-01-01")

        for (var i = times.length - 1; i >= 0; i--) {
          if (timePointer.isSameOrBefore(times[i])) {
            timePointer = moment(times[i])
          }
        }

        let stopTime = moment().subtract(BACKFILL_SCALER, BACKFILL_UNIT)
        let endTimes: string[] = []

        while (timePointer.isSameOrAfter(stopTime)) {
          endTimes.push(timePointer.format())
          timePointer.subtract(ALPACA_BAR_LIMIT * tf[timeframe].constant, tf[timeframe].unit)
        }

        async.eachSeries(endTimes, (end: string, eachTimeCallback: async.ErrorCallback) => {
          async.auto({
            getBars: (autoCallback: async.ErrorCallback) => {
              logger.log('debug', `${timeframe} for ${chunk.length} symbols`)
              this.alpaca.getBars(timeframe, chunk, { end }, autoCallback)
            },
            storeBars: ['getBars', (results: any, autoCallback: async.ErrorCallback) => {
              const bars = _.flatten(_.map(results.getBars, (bars: IBar[], symbol: string) => {
                return _.map(bars, (b: IAssetBar) => {
                  b.symbol = symbol
                  b.timeframe = timeframe
                  return b
                })
              }))
              const lines: any[] = _.map(bars, (bar: IAssetBar) => {
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

              if (lines.length > 0) {
                this.influx.batchWrite('marketData', lines, (err, ret) => {
                  if (err) {
                    logger.log('error', err)
                  } else {
                    logger.log('info', `${timeframe} Bar Backfill complete for ${_.first(chunk)} group from ${end}`)
                  }
                  autoCallback(err)
                })
              } else {
                logger.log('warn', `No data to write, skipping Influx load.`)
                autoCallback()
              }
            }]
          }, ASYNC_LIMIT, eachTimeCallback)
        }, eachChunkCallback)
      })
    }, (err: any) => {
      if (err) {
        logger.log('error', err)
      } else {
        logger.log('info', `${timeframe} Bar Backfill complete from ${overallStartingBarTime}`)
        this.startCronJobs()
      }
    })
  }
  private fetchBars(timeframe: string, limit: number) {
    logger.log('info', `Starting ${timeframe} Bar Fetch`)
    const symbolChunks: string[][] = _.chunk(this.assets, ALPACA_SYMBOL_LIMIT)
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
          const lines: any[] = _.map(bars, (bar: IAssetBar) => {
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

          if (lines.length > 0) {
            this.influx.batchWrite('marketData', lines, autoCallback)
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

  private getRawSentimentData() {
    async.eachLimit(this.assets, ASYNC_LIMIT, (symbol: string, eachCallback: async.ErrorCallback) => {
      logger.log('info', `Getting raw news sentiment for ${symbol}`)
      this.alpaca.getNews(symbol, (err: any, news: INews[]) => {
        if (err) {
          eachCallback(err)
        } else {
          async.mapLimit(news, ASYNC_LIMIT, (n: INews, mapCallback: async.ErrorCallback) => {
            const t = moment(n.timestamp).unix()
            async.auto({
              title: (autoCallback: Function) => {
                this.influx.write('sentiment', symbol, { source: 'title' }, _.pick(sentiment.analyze(n.title), ['score', 'comparative']), t, autoCallback)
              },
              summary: (autoCallback: Function) => {
                this.influx.write('sentiment', symbol, { source: 'summary' }, _.pick(sentiment.analyze(n.summary), ['score', 'comparative']), t, autoCallback)
              },
              article: (autoCallback: Function) => {
                extract(n.url).then((article) => {
                  this.influx.write('indicators', symbol, {
                    source: 'articleContent',
                    indicator: "sentiment_AFINN-165"
                  }, _.pick(sentiment.analyze(article.content), ['score', 'comparative']), t, autoCallback)
                }).catch((err) => {
                  logger.log('debug', `Error extracting article for ${symbol}: ${n.title}`)
                  autoCallback()
                })
              }
            }, mapCallback)
          }, (err: any) => {
              if (err) {
                logger.log('error', err)
              } else {
                logger.log('info', `Raw sentiment generated from ${news.length} news items for ${symbol}`)
              }
              eachCallback(err)
          })
        }
      })
    }, (err: any) => {
      if (err) {
        logger.log('error', err)
      } else {
        logger.log('info', `Raw sentiment gathered`)
      }
    })
  }
}
