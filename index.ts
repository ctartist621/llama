/// <reference path="typings/index.d.ts"/>

import Historian from './lib/Historian'
import Alpaca from './lib/Alpaca'
import Redis from './lib/Redis'

const alpaca = new Alpaca()
const redis = new Redis()

import Logger from "./lib/Logger"
const logger = new Logger("Llama")

console.log("Starting")
logger.log('info', "Starting Historian")
const historian = new Historian(alpaca, redis)