# llama

A Day trading bot for Alpaca

## Operations

### Historian
Responsible for gathering Level I Market Data from the REST Api.
1. Overnight, collect asset records for processing
2. For all tradable assets, queue them for analysis


### Quant
Responsible for deciding what symbols the Broker should trade by running an off-line analysis on all assets.  Any assets that pass the filter will be passed onto the broker for trading.

#### Sentiment Analysis
If news was good, and now bad, buy.  Probably a bump in the road

### Broker
For all assets that will be traded, the broker will subscribe to the websocket stream for those assets to determine what bid to open the position at, and then maintain the stream to determine when to close the position.  Only after closing the position will the topics for a particular asset be unsubscribed.