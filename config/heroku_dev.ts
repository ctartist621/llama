export default {
  alpaca: {
    baseUrl: process.env.ALPACA_BASE_URL,
    keyId: process.env.ALPACA_KEY_ID,
    secretKey: process.env.ALPACA_SECRET_KEY,
    paper: true,
  },
  redis: process.env.REDIS_URL,
  influx: {
    host: process.env.INFLUX_HOST,
    token: process.env.INFLUX_TOKEN,
    org: process.env.INFLUX_ORG,
  }
};
