/// <reference path='../typings/index.d.ts'/>

import _ from 'lodash'
import async from 'async'

import Influx from './Influx'
import Redis from './Redis'

import Logger from './Logger'
const logger = new Logger('Processor')

const WRITE_PRECISION = 'ms'

export namespace IBucket {
  interface Links {
    labels: string;
    logs: string;
    members: string;
    org: string;
    owners: string;
    self: string;
    write: string;
  }

  interface RetentionRules {
    type: string;
    everySeconds: number;
  }

  interface Labels {
    id: string;
    orgId: string;
    name: string;
    properties: LabelProperties;
  }

  interface LabelProperties {
    color: string;
    description: string;
  }

  export interface Bucket {
    links: Links;
    id: string;
    type: string;
    name: string;
    description: string;
    orgID: string;
    rp: string;
    createdAt: string;
    updatedAt: string;
    retentionRules: RetentionRules[];
    labels: Labels[]
  }
}

const BUCKETS = ['indicators', 'quotes', 'stockMarketData', 'trades']

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

    // this.influx.listAllBuckets((err: Error, buckets: IBucket.Bucket[]) => {
    //   if (err) {
    //     throw(err)
    //   } else {
    //     console.log(_.map(buckets, 'name'))

    //     if(condition) {
    //       // code...
    //     }
    //     process.exit()
        this.processStream()
    //   }
    // })

  }

  processStream() {
    async.forever((next: any) => {
      async.retry({
        times: 1000000,
        interval: 1000
      }, (retryCallback: any) => {
        async.auto({
          messages: (autoCallback) => {
            const MESSAGE_COUNT = 1
            this.redis.readStreamInterator('stockMarketData', MESSAGE_COUNT, autoCallback)
          },
          processMessages:['messages', (results: any, autoCallback) => {
            async.each(results.messages, (message: any, eachCallback: any) => {
              async.auto({
                processMessage: (autoCallback2) => {
                  // logger.log('silly', JSON.stringify(results.messages))
                  async.each(message.updates, (update: any, eachCallback2: any) => {
                    // console.log(update)
                    switch (update.ev) {
                      case "Q":
                        this.processQuote(update, eachCallback2)
                        break;
                      case "T":
                        this.processTrade(update, eachCallback2)
                        break;
                      default:
                        logger.log('warn', `Unrecognized Update: ${JSON.stringify(update)}`)
                        eachCallback2()
                        // eachCallback2(`Unrecognized Update: ${JSON.stringify(update)}`)
                        break;
                    }
                  }, autoCallback2)
                },
                ackMessage: ['processMessage', (results2, autoCallback2) => {
                  this.redis.ackStreamMessage('stockMarketData', message.id, autoCallback2)
                }]
              }, eachCallback)
            }, autoCallback)
          }],
        }, retryCallback)
      }, next);
    }, (err) => {
      if (err) {
        logger.log('error', err)
        // throw err;
        // process.exit(1)
      }
    })
  }

  processQuote(message, cb) {
    this.redis.updateQuoteBook(message, cb)
    // async.auto({
    //   writeToInflux: (autoCallback) => {
    //     this.influx.write('quotes', message.sym, {
    //       ax: message.ax,
    //       bx: message.bx,
    //       c: message.c,
    //       uniq: process.hrtime()[1]
    //     }, {
    //       bp: message.bp,
    //       bs: message.bs,
    //       ap: message.ap,
    //       as: message.as,
    //     }, message.t, WRITE_PRECISION, autoCallback)
    //   },
    //   updateBook: (autoCallback) => {
    //     this.redis.updateQuoteBook(message, autoCallback)
    //   }
    // }, cb)
  }

  processTrade(message, cb) {
    this.redis.updateQuoteBookWithTrade(message, (err, results) => {
      cb(err, results)
    })
    // this.influx.write('trades', message.sym, {
    //   x: message.x,
    //   z: message.z,
    //   c: message.c,
    //   i: message.i,
    //   uniq: process.hrtime()[1]
    // }, {
    //   p: message.p,
    //   s: message.s,
    // }, message.t, WRITE_PRECISION, cb)
  }
}
