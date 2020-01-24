import Alpaca from '../../lib/Alpaca'
import 'jest-extended';

const alpaca = new Alpaca()

const TIMEOUT = 5000

const assetMatcher = {
  id: expect.stringMatching(/[A-Za-z0-9\-]+/),
  class: expect.stringMatching('us_equity'),
  exchange: expect.stringMatching(/AMEX|ARCA|BATS|NYSE|NASDAQ|NYSEARCA/),
  symbol: expect.stringMatching(/[A-Z]+/),
  status: expect.stringMatching(/active|inactive/),
  tradable: expect.toBeBoolean(),
  marginable: expect.toBeBoolean(),
  shortable: expect.toBeBoolean(),
  easy_to_borrow: expect.toBeBoolean()
}

describe('Alpaca', () => {
  describe('API', () => {
    test('Get All Assets', done => {
      expect.assertions(3);
      alpaca.getAllAssets((err, assets) => {
        expect(err).toBeUndefined()
        expect(assets).toBeArray()
        expect(assets[0]).toMatchObject(assetMatcher)
        done()
      })
    }, TIMEOUT)
  })
})

