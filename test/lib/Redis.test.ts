import Redis from '../../lib/Redis'
import R from 'ioredis'
import 'jest-extended'
import config from 'config'

const redis = new Redis()
const r = new R(config.get('redis'))

const TIMEOUT = 5000

const item = { foo: 'bar' }

describe('Redis', () => {
  beforeEach(done => {
    r.lpush("testList", JSON.stringify(item), done)
  })
  afterEach(done => {
    r.del("testList", done)
  })
  test('Queue', done => {
    expect.assertions(2);
    redis.queueObj("testList", item, (err, ret) => {
      expect(err).toBeNull()
      expect(ret).toBeNumber()
      done()
    })
  }, TIMEOUT)
  test('Dequeue', done => {
    expect.assertions(2);
    redis.dequeueObj("testList", (err, ret) => {
      expect(err).toBeNull()
      expect(ret).toMatchObject(item)
      done()
    })
  }, TIMEOUT)
})

