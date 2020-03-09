import Influx from '../../lib/Influx'
import 'jest-extended'
import moment from 'moment'

const influx = new Influx()

const TIMEOUT = 5000

const t: Number = moment().unix()

describe('Influx', () => {
  describe('Line', () => {
    // test.each([
    //   ["No Tags", {} , {field1: 1}, t, "foo"]
    // ])('Line test %#', (measurement: string, tags: any, fields: any, timestamp: number, expected: string) => {
    //   const line = influx.getLine(measurement, tags, fields, timestamp)
    //   console.log(line)
    // }, TIMEOUT)
  })
})