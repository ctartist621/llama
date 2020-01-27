import config from 'config'
import needle from "needle"
import _ from 'lodash'

import Logger from "./Logger"
const logger = new Logger("Influx")

export default class Influx {
  options: any
  conf: any
  endpoints: any

  constructor() {
    this.conf = config.get('influx')
    this.options = {
      headers: {
        Authorization: `Token ${this.conf.token}`
      }
    }
    this.endpoints = {
      write: `${this.conf.host}/api/v2/write?org=${this.conf.org}&bucket=${this.conf.bucket}&precision=s`
    }
  }

  getLine(measurement: String, tags: any, fields: any, timestamp: Number) {
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

  write(measurement: String, tags: any, fields: any, timestamp: Number, cb: Function) {
    const line = this.getLine(measurement, tags, fields, timestamp)
    needle.post(this.endpoints.write, line, this.options, function(err, resp, body) {
      if (err) {
        logger.log('error', err)
      } else {
        logger.log('debug', `Point recorded: ${line}, ${JSON.stringify(body)}`)
      }
      cb(err, body)
    })
  }

  batchWrite(measurement: String, tags: any, fields: any, timestamp: Number, cb: Function) {
    const line = this.getLine(measurement, tags, fields, timestamp)
    needle.post(this.endpoints.write, line, this.options, function(err, resp, body) {
      if (err) {
        logger.log('error', err)
      } else {
        logger.log('debug', `Point recorded: ${line}, ${JSON.stringify(body)}`)
      }
      cb(err, body)
    })
  }
}