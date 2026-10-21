/// <reference types="jest" />
import {cspViolationPrefix, describeCspViolation, makeCspViolationLogger, stripURL} from './csp-violations.desktop'

const violation = (o: Partial<Parameters<typeof describeCspViolation>[0]> = {}) => ({
  blockedURI: 'http://127.0.0.1:52345/at?key=secretkey&prev=true',
  effectiveDirective: 'img-src',
  lineNumber: 12,
  sample: '',
  sourceFile: 'kbapp://app/desktop/renderer/main.js?v=1',
  ...o,
})

describe('stripURL', () => {
  test('drops the query and hash', () => {
    expect(stripURL('http://127.0.0.1:52345/av?typ=user&name=testuser&token=abc')).toBe('http://127.0.0.1:52345/av')
    expect(stripURL('http://127.0.0.1:52345/files/private/testuser/a.pdf#page=2')).toBe(
      'http://127.0.0.1:52345/files/private/testuser/a.pdf'
    )
    expect(stripURL('http://127.0.0.1:52345/at#x?token=abc')).toBe('http://127.0.0.1:52345/at')
  })

  test('keeps keywords and plain URLs', () => {
    expect(stripURL('inline')).toBe('inline')
    expect(stripURL('https://keybase.io/images/x.png')).toBe('https://keybase.io/images/x.png')
    expect(stripURL('')).toBe('')
  })

  test('bounds the length', () => {
    expect(stripURL(`https://example.com/${'a'.repeat(500)}`)).toHaveLength(200)
  })
})

describe('describeCspViolation', () => {
  test('names the directive, the blocked URL and the source without their queries', () => {
    const {key, message} = describeCspViolation(violation())
    expect(key).toBe('img-src http://127.0.0.1:52345/at')
    expect(message).toBe(`${cspViolationPrefix} img-src http://127.0.0.1:52345/at at kbapp://app/desktop/renderer/main.js:12`)
    expect(message).not.toContain('secretkey')
  })

  test('names the sink of a Trusted Types violation, never the value', () => {
    const {key, message} = describeCspViolation(
      violation({
        blockedURI: 'trusted-types-sink',
        effectiveDirective: 'require-trusted-types-for',
        sample: 'Element innerHTML|<img src=x token=abc>',
      })
    )
    expect(key).toBe('require-trusted-types-for trusted-types-sink Element innerHTML')
    expect(message).not.toContain('token')
  })

  test('says when there is no blocked URL or source', () => {
    expect(describeCspViolation(violation({blockedURI: '', sourceFile: ''})).message).toBe(
      `${cspViolationPrefix} img-src (none) at (no source)`
    )
  })
})

describe('makeCspViolationLogger', () => {
  test('logs each directive + URL once, whatever the query', () => {
    const log = jest.fn()
    const onViolation = makeCspViolationLogger(log)
    onViolation(violation())
    onViolation(violation({blockedURI: 'http://127.0.0.1:52345/at?key=other'}))
    onViolation(violation({effectiveDirective: 'media-src'}))
    expect(log).toHaveBeenCalledTimes(2)
  })

  test('stops after the limit with one notice', () => {
    const log = jest.fn()
    const onViolation = makeCspViolationLogger(log, 2)
    for (let i = 0; i < 10; i++) {
      onViolation(violation({blockedURI: `https://example.com/${i}`}))
    }
    expect(log).toHaveBeenCalledTimes(3)
    expect(log).toHaveBeenNthCalledWith(2, expect.stringContaining('https://example.com/1'))
    expect(log).toHaveBeenLastCalledWith(`${cspViolationPrefix} more than 2 kinds, no longer logging`)
  })
})
