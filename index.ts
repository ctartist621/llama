/// <reference path="typings/index.d.ts"/>

import Historian from './lib/Historian'
import Quant from './lib/Quant'

import Alpaca from './lib/Alpaca'
import Influx from './lib/Influx'
import Redis from './lib/Redis'

const alpaca = new Alpaca()
const influx = new Influx()
const redis = new Redis()

import Logger from "./lib/Logger"
const logger = new Logger("Llama")

const program = require('commander')

console.log("Starting Llama")

program
  .option('-f, --function <function>', 'Function to perform (Historian, Quant, Broker')
  .option('-c, --quantConfig', 'Generate Quant Options Template. WARNING: This will overwrite an existing config file')
  .parse(process.argv);

if(program.function) {
  switch (program.function) {
    case "historian":
      logger.log('info', "Starting Historian")
      const historian = new Historian(alpaca, influx, redis)
      break;

    case "quant":
      logger.log('info', "Starting Quant")
      const quant = new Quant(alpaca, influx, redis)
      break;

    default:
      logger.log('error', "That Function is not supported.")
      break;
  }
} else if (program.quantConfig) {
  Quant.generateOptionsTemplate((err, ret) => {
    if(err) {
      logger.log('error', err)
      process.exit(1)
    } else {
      process.exit()
    }
  })
}
