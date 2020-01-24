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

const barsMatcher = {
  t: expect.toBeNumber(),
  o: expect.toBeNumber(),
  h: expect.toBeNumber(),
  l: expect.toBeNumber(),
  c: expect.toBeNumber(),
  v: expect.toBeNumber(),
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
    test('Get Assets', done => {
      expect.assertions(2);
      alpaca.getAsset("AAPL", (err, asset) => {
        expect(err).toBeUndefined()
        expect(asset).toMatchObject(assetMatcher)
        done()
      })
    }, TIMEOUT)
    test('Get Bars', done => {
      expect.assertions(3);
      alpaca.getBars("1D", "AAPL", {}, (err, bars) => {
        expect(err).toBeUndefined()
        expect(bars).toBeArray()
        expect(bars[0]).toMatchObject(barsMatcher)
        done()
      })
    }, TIMEOUT)
  })
})

