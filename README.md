# llama

A Day trading bot for Alpaca

## Operations / Microservices

### Historian
Responsible for gathering Level I Market Data from the REST API.
1. Collect asset records for processing
2. Gather news and perform sentiment analysis using AFINN-165

#### Sentiment Analysis
If news was good, and now bad, buy.  Probably a bump in the road.

### Quant
Responsible for calculating technical indicators and storing results in the Influx TSDB.

### Broker
Responsible for deciding what symbols the Trader should trade by running an off-line analysis on all assets.  Any assets that pass the filter will be flagged for trading.

For each stock, it will identify Buy, Sell, and Hold based on technical indicators and other analysis, as well as calculating a forecasted price analysis with associated probabilities.

### Trader
For all assets that will be traded, the Broker will subscribe to the websocket stream for those assets to determine what bid to open the position at, and then maintain the stream to determine when to close the position.  Only after closing the position will the topics for a particular asset be unsubscribed.

### Recorder
Future Work: Parse live stream.

## Deployment
This is currently being deployed to my home network on an [antsle box](https://antsle.com).

Each service runs as it's own [docker container](https://www.docker.com/resources/what-container), using a [bridge network](https://docs.docker.com/network/bridge/) to communicate.

### Future work
CI/CD through [CircleCI](https://www.docker.com/resources/what-container) with [Gitflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow).
