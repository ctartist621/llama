/// <reference path='../typings/index.d.ts'/>

import _ from 'lodash'
import async from 'async'

import Influx from './Influx'
import Redis from './Redis'

import Logger from './Logger'
const logger = new Logger('Processor')

const WRITE_PRECISION = 'ms'

export default class Processor {
  private redis: Redis
  private influx: Influx

  private cronJobs: any

  constructor(i: Influx, r: Redis) {
    this.redis = r
    this.influx = i

    setInterval(() => {
      const used = process.memoryUsage().heapUsed / 1024 / 1024;
      logger.log("debug", `Processor uses approximately ${Math.round(used * 100) / 100} MB`);
    }, 1000)

    this.processStream()
  }

  processStream() {
    async.forever((next: any) => {
      async.retry({
        times: 1000000,
        interval: 1000
      }, (retryCallback: any) => {
        async.auto({
          message: (autoCallback) => {
            this.redis.readStreamInterator('cryptoMarketData', 1, autoCallback)
          },
          processMessage: ['message', (results, autoCallback) => {
            switch (results.message.ev) {
              case "Q":
                this.processQuote(results.message, autoCallback)
                break;
              case "T":
                this.processTrade(results.message, autoCallback)
                break;
              default:
                logger.log('warn', `Unrecognized Message: ${JSON.stringify(results.message)}`)
                autoCallback()
                break;
            }
          }]
        }, retryCallback)
      }, next);
    }, (err) => {
      if (err) {
        console.log(err)
      }
    })
  }

  processQuote(message, cb) {
    this.influx.write('quotes', message.sym, {
      ax: message.ax,
      bx: message.bx,
      c: message.c,
      uniq: process.hrtime()[1]
    }, {
      bp: message.bp,
      bs: message.bs,
      ap: message.ap,
      as: message.as,
    }, message.t, WRITE_PRECISION, cb)
  }

  processTrade(message, cb) {
    this.influx.write('trades', message.sym, {
      x: message.x,
      z: message.z,
      c: message.c,
      i: message.i,
      uniq: process.hrtime()[1]
    }, {
      p: message.p,
      s: message.s,
    }, message.t, WRITE_PRECISION, cb)
  }
}
