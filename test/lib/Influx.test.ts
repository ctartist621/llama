import Influx from '../../lib/Influx'
import 'jest-extended'
import moment from 'moment'

const influx = new Influx()

const TIMEOUT = 5000

describe('Influx', () => {
  describe('Line', () => {
    test('Line with just one value', () => {
      const line = influx.getLine('test',null ,{val1: 1}, moment().unix())
      console.log(line)
    }, TIMEOUT)
  })
})