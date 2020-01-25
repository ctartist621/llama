import config from 'config'
import needle from "needle"
import _ from 'lodash'

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

    needle.post(this.endpoints.write, this.getLine(measurement, tags, fields, timestamp), this.options, function(err, resp, body) {
      cb(err, body)
    })

  }
}