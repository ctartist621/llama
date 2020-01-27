/// <reference path="../typings/index.d.ts"/>

import _ from 'lodash'
import async from 'async'
import Alpaca from './Alpaca'
import Influx from './Influx'
import Redis from './Redis'

const ASYNC_LIMIT = 2
const ASSET_INTERVAL = 3600000

import Logger from "./Logger"
const logger = new Logger("Historian")

export default class Quant {
  alpaca: any
  influx: Influx
  redis: Redis

  fetchAssetInterval: any
  assetQueue: any
  barQueue: any

  constructor(a: Alpaca, i: Influx, r: Redis) {
    this.alpaca = a
    this.influx = i
    this.redis = r

    this.runAnalysis()
  }

  runAnalysis() {
    async.auto
  }
}