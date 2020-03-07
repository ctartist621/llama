/// <reference path="../typings/index.d.ts"/>

const A = require('@alpacahq/alpaca-trade-api')
import config from 'config'
import _ from 'lodash'
import needle from "needle"

import Logger from "./Logger"
const logger = new Logger("TipRanks")
import Limiter from 'limiter'
import retry from 'retry'

const TIPRANKS_RATE_LIMIT = 200 // 200/min https://docs.alpaca.markets/api-documentation/api-v2/

export default class TipRanks {
  client: any
  limiter: Limiter.RateLimiter
  baseUrl: string
  endpoints: any

  constructor() {
    this.client = new A(config.get('alpaca'))
    this.limiter = new Limiter.RateLimiter(TIPRANKS_RATE_LIMIT, 'minute')
    this.baseUrl = 'https://www.tipranks.com/api/stocks'
    this.endpoints = {
      data: `${this.baseUrl}/getData/`,
    }

  }

  private throttle(func: any, cb: Function) {
    this.limiter.removeTokens(1, (err, remainingRequests) => {
      if (remainingRequests < TIPRANKS_RATE_LIMIT / 2) {
        logger.log('warn', `Remaining TipRanks requests: ${remainingRequests}`)
      } else {
        logger.log('silly', `Remaining TipRanks requests: ${remainingRequests}`)
      }
      if (err) {
        cb(err)
      } else {
        func
      }
    })
  }

  private call(url, cb) {
    console.log(url, cb)
    needle.get(url, (err, res, body) => {
      console.log(err, body)
      process.exit()
    })
  }

  getData(symbol: string, cb: Function) {
    const func = this.call(`${this.endpoints.data}?name=${symbol}`, cb)

    this.throttle(func, cb)
  }
}
