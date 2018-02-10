// @flow
/* eslint-env jest */
import {dumpLine, parseLine} from '../native-logger'

describe('parseLine', () => {
  it('dump/parse round trip', () => {
    const ts = Date.now()
    const logLine = 'test log line'
    const s = dumpLine(ts, logLine)
    const [ts2, logLine2] = parseLine(s)
    expect(ts2).toEqual(ts)
    expect(logLine2).toEqual(logLine)
  })
})
