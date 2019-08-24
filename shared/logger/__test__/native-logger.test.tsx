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

  it('parse with whitespace', () => {
    const ts = Date.now()
    const logLine = 'test log line'

    {
      const [ts2, logLine2] = parseLine(`[${ts}, "${logLine}"]`)
      expect(ts2).toEqual(ts)
      expect(logLine2).toEqual(logLine)
    }

    {
      const [ts2, logLine2] = parseLine(` [  ${ts}  ,  "${logLine}" ]`)
      expect(ts2).toEqual(ts)
      expect(logLine2).toEqual(logLine)
    }

    {
      const [ts2, logLine2] = parseLine(`[${ts},"${logLine}"]`)
      expect(ts2).toEqual(ts)
      expect(logLine2).toEqual(logLine)
    }
  })

  it('parse empty', () => {
    {
      const ts = Date.now()
      const [ts2, logLine2] = parseLine(`[${ts}, ""]`)
      expect(ts2).toEqual(ts)
      expect(logLine2).toEqual('')
    }
  })

  it('parse truncated', () => {
    const ts = Date.now()
    const logLine = 'test log line'

    {
      const [ts2, logLine2] = parseLine(`[${ts}, "${logLine}"`)
      expect(ts2).toEqual(ts)
      expect(logLine2).toEqual(logLine)
    }

    {
      const [ts2, logLine2] = parseLine(`[${ts}, "${logLine}`)
      expect(ts2).toEqual(ts)
      expect(logLine2).toEqual(logLine)
    }
  })
})
