/// <reference path="typings/index.d.ts"/>

// import Broker from './lib/Broker'
// import Historian from './lib/Historian'
// import Quant from './lib/Quant'
// import Recorder from './lib/Recorder'
// import CryptoRecorder from './lib/CryptoRecorder'
// import Processor from './lib/Processor'

// import Alpaca from './lib/Alpaca'
// import Influx from './lib/Influx'
// import Redis from './lib/Redis'

import Logger from "./lib/Logger"
const logger = new Logger("Llama")

const program = require('commander')

let Alpaca, Influx, Redis, alpaca, influx, redis


console.log("Starting Llama")

program
  .option('-f, --function <function>', 'Function to perform (Historian, Quant, Broker, Recorder, Processor, cryptoRecorder')
  .option('-c, --quantConfig', 'Generate Quant Options Template. WARNING: This will overwrite an existing config file')
  .parse(process.argv);

if(program.function) {
  switch (program.function) {
    case "broker":
      logger.log('info', "Starting Broker")
      Alpaca = require('./lib/Alpaca').default
      Influx = require('./lib/Influx').default
      Redis = require('./lib/Redis').default
      alpaca = new Alpaca()
      influx = new Influx()
      redis = new Redis()
      const Broker = require('./lib/Broker').default
      const broker = new Broker(alpaca, influx, redis)
      break;

    case "historian":
      logger.log('info', "Starting Historian")
      Alpaca = require('./lib/Alpaca').default
      Influx = require('./lib/Influx').default
      Redis = require('./lib/Redis').default
      alpaca = new Alpaca()
      influx = new Influx()
      redis = new Redis()
      const Historian = require('./lib/Historian').default
      const historian = new Historian(alpaca, influx, redis)
      break;

    case "quant":
      logger.log('info', "Starting Quant")
      Alpaca = require('./lib/Alpaca').default
      Influx = require('./lib/Influx').default
      Redis = require('./lib/Redis').default
      alpaca = new Alpaca()
      influx = new Influx()
      redis = new Redis()
      const Quant = require('./lib/Quant').default
      const quant = new Quant(alpaca, influx, redis)
      break;

    case "recorder":
      logger.log('info', "Starting Recorder")
      Alpaca = require('./lib/Alpaca').default
      Redis = require('./lib/Redis').default
      alpaca = new Alpaca()
      redis = new Redis()
      const Recorder = require('./lib/Recorder').default
      const recorder = new Recorder(alpaca, redis)
      break;

    case "cryptoRecorder":
      logger.log('info', "Starting Crypto Recorder")
      Redis = require('./lib/Redis').default
      redis = new Redis()
      const CryptoRecorder = require('./lib/CryptoRecorder').default
      const cryptoRecorder = new CryptoRecorder(redis)
      break;

    case "processor":
      logger.log('info', "Starting Processor")
      Influx = require('./lib/Influx').default
      Redis = require('./lib/Redis').default
      influx = new Influx()
      redis = new Redis()
      const Processor = require('./lib/Processor').default
      const processor = new Processor(influx, redis)
      break;

    default:
      logger.log('error', "That Function is not supported.")
      break;
  }
} else if (program.quantConfig) {
  const Quant = require('./lib/Quant').default
  Quant.generateOptionsTemplate((err, ret) => {
    if(err) {
      logger.log('error', err)
      process.exit(1)
    } else {
      process.exit()
    }
  })
}
