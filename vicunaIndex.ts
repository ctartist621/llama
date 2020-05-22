/// <reference path="typings/index.d.ts"/>

import _ from 'lodash'

import Alpaca from './lib/Alpaca'
import Vicuna from './lib/Vicuna'
// import Influx from './lib/Influx'
// import Redis from './lib/Redis'

let alpaca = new Alpaca()
import async from 'async'

import Logger from "./lib/Logger"
const logger = new Logger("Vicuna Startup")

const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  console.log('Retrieving assets to trade')

  async.auto({
    positions: (autoCallback) => {
      alpaca.getPositions(autoCallback)
    },
    watchlistAssets: (autoCallback) => {
        alpaca.getWatchlistAssets(autoCallback)
    },
  }, (err, results: any) => {
    const symbolsToTrade = _.map(_.union(results.positions, results.watchlistAssets), 'symbol')
    cluster.fork({
      symbol: 'F'
    });

    // let feeds = [
    //   'trade_updates',
    //   'account_updates',
    // ]

    // _.each(symbolsToTrade, (s) => {
    //   feeds.push(`T.${s}`)
    //   feeds.push(`Q.${s}`)
    //   feeds.push(`A.${s}`)
    //   feeds.push(`AM.${s}`)
    // })

    // alpaca.data_ws.connect()

    // alpaca.data_ws.onConnect(() => {
    //   logger.log("debug", "Connected")
    //   logger.log("debug", `Subscribing to ${feeds}`)
    //   alpaca.data_ws.subscribe(feeds)
    // })
    // alpaca.data_ws.onDisconnect(() => {
    //   logger.log("debug", "Disconnected")
    //   // process.exit()
    //   alpaca.data_ws.connect()
    // })

    // Fork workers.
    // for (let i = 0; i < Math.min(numCPUs, symbolsToTrade.length); i++) {
    //   cluster.fork({
    //     symbol: symbolsToTrade[i]
    //   });
    // }
  })

 } else {
  // Workers can share any TCP connection
  // In this case it is an HTTP server
  const vicuna = new Vicuna(alpaca, process.env.symbol)

  console.log(`Worker ${process.pid} started with symbol ${process.env.symbol}`);
}
