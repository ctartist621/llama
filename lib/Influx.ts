import config from 'config'
import needle from "needle"
import _ from 'lodash'
import async from 'async'

import Logger from "./Logger"
const logger = new Logger("Influx")
const parse = require('csv-parse')

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
      write: `${this.conf.host}/api/v2/write?org=${this.conf.org}&precision=s`,
      query: `${this.conf.host}/api/v2/query?org=${this.conf.org}`
    }
  }

  getLine(measurement: string, tags: any, fields: any, timestamp: Number) {
    let tStr: string = ""
    let fStr: string = ""

    for (let t in tags) {
      tStr += `,${t}=${tags[t]}`
    }

    for (let f in fields) {
      fStr += `,${f}=${fields[f]}`
    }

    return `${measurement}${tStr} ${_.trimStart(fStr, ',')} ${timestamp}`
  }

  write(bucket: string, measurement: string, tags: any, fields: any, timestamp: Number, cb: Function) {
    const line = this.getLine(measurement, tags, fields, timestamp)
    needle.post(`${this.endpoints.write}&bucket=${bucket}`, line, this.options, function(err, resp, body) {
      if (err) {
        logger.log('error', err)
      } else {
        logger.log('silly', `Point recorded: ${line}, ${JSON.stringify(body)}`)
      }
      cb(err, body)
    })
  }

  batchWrite(bucket: string, lines: string[], cb: Function) {
    needle.post(`${this.endpoints.write}&bucket=${bucket}`, _.join(lines, '\n'), this.options, function(err, resp, body) {
      if (err) {
        logger.log('error', err)
      } else {
        logger.log('silly', `${lines.length} Points recorded`)
      }
      cb(err, body)
    })
  }

  oldestBarTime(asset: string, timeframe: string, range: string, cb: any) {
    let o = this.options
    o.headers.Accept = "application/csv"
    o.headers["Content-type"] = "application/vnd.flux"

    const query = `from(bucket: "marketData")
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

  queryMarketData(asset: string, field: string, timeframe: string, start: string, stop: string, columnArray=true, cb: Function) {
    let o = this.options
    o.headers.Accept = "application/csv"
    o.headers["Content-type"] = "application/vnd.flux"

    // const query = `from(bucket: "marketData")
    //   |> range(start: -100d)
    //   |> filter(fn: (r) => r.field == "${field}")
    //   |> filter(fn: (r) => r._measurement == "${asset}")
    //   |> filter(fn: (r) => r.timeframe == "${timeframe}")`

    const query = `from(bucket: "marketData")
      |> range(start: -100d)
      |> filter(fn: (r) => r._measurement == "AAWW")
      |> filter(fn: (r) => r.timeframe == "1D")`

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
              ret[(_.first(j) as any)._field] = _.map(j, '_value')
              ret.time = _.map(j, '_time')
              mapCallback(err, ret)
            }
          })
        }, (err, tables) => {
          if(err) {
            cb(err)
          } else {
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
