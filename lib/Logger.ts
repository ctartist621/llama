import winston from "winston"

export default class Logger {
  logger: winston.Logger
  context: string|undefined
  constructor(context?: string) {
    this.context = context ? `[${context}] ` : ""
    this.logger =  winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        //
        // - Write to all logs with level `info` and below to `combined.log`
        // - Write all logs error (and below) to `error.log`.
        //
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
      ]
    });
  }

  private logString(l:string) {
    return `${this.context}${l}`
  }

  log(level, l) {
    this.logger.log(level, this.logString(l))
  }
}