import config from 'config'
import needle from "needle"
import _ from 'lodash'
import async from 'async'

import Logger from "./Logger"
const logger = new Logger("Influx")
const parse = require('csv-parse')

const WINDOW = 5


const TIMEFRAME = {
  '1D': { constant: 1, unit: 'days', i: '1d' },
  '15Min': { constant: 15, unit: 'minutes', i: '15m' },
  '5Min': { constant: 5, unit: 'minutes', i: '5m' },
  '1Min': { constant: 1, unit: 'minutes', i: '1m' },
}

export default class Influx {
  options: any
  conf: any
  endpoints: any
  client: any

  constructor() {
    this.conf = config.get('influx')
    this.options = {
      headers: {
        Authorization: `Token ${this.conf.token}`
      }
    }
    this.endpoints = {
      write: `${this.conf.host}/api/v2/write?org=${this.conf.org}`,
      query: `${this.conf.host}/api/v2/query?org=${this.conf.org}`,
      buckets: `${this.conf.host}/api/v2/buckets`
    }
  }

  getLine(measurement: string, tags: any, fields: any, timestamp: Number) {
    let tStr: string = ""
    let fStr: string = ""

    for (let t in tags) {
      if (t !== 'c' && tags[t]) {
        tStr += `,${t}=${tags[t]}`
      }
    }

    for (let f in fields) {
      if (fields[f]) {
        fStr += `,${f}=${fields[f]}`
      }
    }

    return `${measurement}${tStr} ${_.trimStart(fStr, ',')} ${timestamp}`
  }

  write(bucket: string, measurement: string, tags: any, fields: any, timestamp: Number, precision: string, cb: Function) {
    const line = this.getLine(measurement, tags, fields, timestamp)
    needle.post(`${this.endpoints.write}&bucket=${bucket}&precision=${precision}`, line, this.options, function(err, resp, body) {
      if (err || body.code == 'invalid') {
        logger.log('error', err || body.message)
        // console.log(line)
        // console.log(measurement, tags, fields, timestamp)
        // process.exit()
        cb(err || body.message, body)
      } else {
        logger.log('silly', `Point recorded: ${line}, ${JSON.stringify(body)}`)
        cb(err, body)
      }
    })
  }

  batchWrite(bucket: string, lines: string[], precision: string, cb: any) {
    let func: any = async.retry({
      times: 10,
      interval: function(retryCount) {
        const INTERVAL = 50 * Math.pow(2, retryCount)
        logger.log('debug', `Retrying to Store Batch Write after ${INTERVAL}ms`)
        return INTERVAL;
      }
    }, (retryCallback) => {
      console.log("Trying to write to Influx")
      try {
        needle.post(`${this.endpoints.write}&bucket=${bucket}&precision=${precision}`, _.join(lines, '\n'), this.options, function(err, resp, body) {
          if (err || body.code == 'invalid') {
            logger.log('error', err || body.message)
          } else {
            logger.log('silly', `${lines.length} Points recorded`)
          }
          retryCallback(err, body)
        })
      } catch (e) {
        logger.log('error', e)
        retryCallback(e)
      }
    }, cb);
  }

  listAllBuckets(cb: Function) {
    needle.get(`${this.endpoints.buckets}`, this.options, function(err, resp, body) {
      if (err) {
        logger.log('error', err)
      } else {
        logger.log('silly', `Buckets retrieved`)
      }
      cb(err, body.buckets)
    })
  }

  oldestBarTime(asset: string, timeframe: string, range: string, cb: any) {
    let o = this.options
    o.headers.Accept = "application/csv"
    o.headers["Content-type"] = "application/vnd.flux"

    const query = `from(bucket: "stockMarketData")
      |> range(start: ${range})
      |> filter(fn: (r) => r._field == "close")
      |> filter(fn: (r) => r._measurement == "${asset}")
      |> filter(fn: (r) => r.timeframe == "${timeframe}")
      |> first()`

    needle.post(`${this.endpoints.query}`, query, o, function(err: any, resp: any, body: any) {
      if (err || body.code) {
        logger.log('error', JSON.stringify(err || body))
        cb(err || body)
      } else {
        // logger.log('silly', `Query successful`)
        const s = _.split(_.trim(body, '\r\n'), '\r\n\r\n')
        async.map(s, (table: string, mapCallback) => {
          parse(table, { columns: true }, (err, j) => {
            if (err) {
              mapCallback(err)
            } else {
              mapCallback(err, _.first(_.flattenDeep(_.map(j, '_time'))))
            }
          })
        }, (err, ret) => {
          if (err) {
            cb(err)
          } else {
            cb(err, _.first(ret))
          }
        })
      }
    })
  }

  getIndicatorDerivatives(asset: string, timeframe: string, cb: any) {
    let o = this.options
    o.headers.Accept = "application/csv"
    o.headers["Content-type"] = "application/vnd.flux"

    const range = `-${WINDOW * 2 * TIMEFRAME[timeframe].constant}${_.first(TIMEFRAME[timeframe].unit)}`

    const query = `from(bucket: "indicators")
      |> range(start: ${range})
      |> filter(fn: (r) => r._measurement == "${asset}")
      |> filter(fn: (r) => r.timeframe == "${timeframe}")
      |> derivative(unit: ${TIMEFRAME[timeframe].i}, nonNegative: true, columns: ["_value"], timeColumn: "_time")
      |> movingAverage(n: ${WINDOW})
      |> yield(name: "derivative")`

    needle.post(`${this.endpoints.query}`, query, o, function(err: any, resp: any, body: any) {
      if (err || body.code) {
        logger.log('error', JSON.stringify(err || body))
        cb(err || body)
      } else {
        // logger.log('silly', `Query successful`)
        console.log(body)
        process.exit()
        const s = _.split(_.trim(body, '\r\n'), '\r\n\r\n')
        async.map(s, (table: string, mapCallback) => {
          parse(table, { columns: true }, (err, j) => {
            if (err) {
              mapCallback(err)
            } else {
              mapCallback(err, _.first(_.flattenDeep(_.map(j, '_time'))))
            }
          })
        }, (err, ret) => {
          if (err) {
            cb(err)
          } else {
            cb(err, _.first(ret))
          }
        })
      }
    })
  }

  queryStockMarketData(asset: string, timeframe: string, start: string, stop: string, columnArray=true, cb: Function) {
    let o = this.options
    o.headers.Accept = "application/csv"
    o.headers["Content-type"] = "application/vnd.flux"

    const query = `from(bucket: "stockMarketData")
      |> range(start: -100d)
      |> filter(fn: (r) => r._measurement == "${asset}")
      |> filter(fn: (r) => r.timeframe == "${timeframe}")`

    needle.post(`${this.endpoints.query}`, query, o, function(err: any, resp: any, body: any) {
      if (err || body.code) {
        logger.log('error', JSON.stringify(err || body))
        cb(err || body)
      } else {
        // logger.log('silly', `Query successful`)
        const s = _.split(_.trim(body, '\r\n'), '\r\n\r\n')
        async.map(s, (table: string, mapCallback) => {
          parse(table, { columns: true }, (err, j) => {
            if (err) {
              mapCallback(err)
            } else {
              let ret: any = {}
              if(_.isEmpty(j)) {
                mapCallback(err)
              } else {
                ret[(_.first(j) as any)._field] = _.map(j, '_value')
                ret.time = _.map(j, '_time')
                mapCallback(err, ret)
              }
            }
          })
        }, (err, tables) => {
          if(err) {
            cb(err)
          } else {
            tables = _.compact(tables)
            cb(err, _.reduce(tables, (r: any, t: any) => {
              r.low = t.low ? t.low : r.low
              r.high = t.high ? t.high : r.high
              r.open = t.open ? t.open : r.open
              r.close = t.close ? t.close : r.close
              r.volume = t.volume ? t.volume : r.volume
              r.time = t.time ? t.time : r.time
              return r
            }, {}))
          }
        })
      }
    })
  }
}
