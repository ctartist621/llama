import R from 'ioredis'
import config from 'config'

export default class Redis {
  client: R
  constructor() {
    this.client = new R(config.get('redis'))
  }

  queueObj(list, item, cb) {
    this.client.rpush(`q_${list}`, JSON.stringify(item), cb)
  }

  dequeueObj(list, cb){
    this.client.lpop(`q_${list}`, (err: object | null, ret: string) => {
      if(err) {
        cb(err)
      } else {
        cb(err, JSON.parse(ret))
      }
    })
  }
}