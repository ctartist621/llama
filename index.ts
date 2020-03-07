/// <reference path="typings/index.d.ts"/>

import Broker from './lib/Broker'
import Historian from './lib/Historian'
import Quant from './lib/Quant'
import Recorder from './lib/Recorder'
import CryptoRecorder from './lib/CryptoRecorder'
import Processor from './lib/Processor'

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
  .option('-f, --function <function>', 'Function to perform (Historian, Quant, Broker, Recorder, Processor, cryptoRecorder')
  .option('-c, --quantConfig', 'Generate Quant Options Template. WARNING: This will overwrite an existing config file')
  .parse(process.argv);

if(program.function) {
  switch (program.function) {
    case "broker":
      logger.log('info', "Starting Broker")
      const broker = new Broker(alpaca, influx, redis)
      break;

    case "historian":
      logger.log('info', "Starting Historian")
      const historian = new Historian(alpaca, influx, redis)
      break;

    case "quant":
      logger.log('info', "Starting Quant")
      const quant = new Quant(alpaca, influx, redis)
      break;

    case "recorder":
      logger.log('info', "Starting Recorder")
      const cryptoRecorder = new Recorder(alpaca, redis)
      break;

    case "cryptoRecorder":
      logger.log('info', "Starting Crypto Recorder")
      const recorder = new CryptoRecorder(redis)
      break;

    case "processor":
      logger.log('info', "Starting Processor")
      const processor = new Processor(influx, redis)
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
