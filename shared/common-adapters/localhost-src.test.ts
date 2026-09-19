/// <reference types="jest" />
import {isLocalhostSrc, retryLocalhostSrc} from './localhost-src'

const httpSrv = {address: '127.0.0.1:61234'}

test('only local service srcs are retryable', () => {
  expect(isLocalhostSrc('http://127.0.0.1:5000/av?name=testuser')).toBe(true)
  expect(isLocalhostSrc('https://keybase.io/images/testuser.png')).toBe(false)
  expect(isLocalhostSrc(3)).toBe(false)
})

test('a retry points a baked attachment url at the current server port', () => {
  const src = 'http://127.0.0.1:5000/att?key=abc&prev=true&noanim=false&isemoji=false'
  expect(retryLocalhostSrc(src, 1, httpSrv)).toBe(
    'http://127.0.0.1:61234/att?key=abc&prev=true&noanim=false&isemoji=false&kbRetry=1'
  )
})

test('a retry keeps the baked address when the current one is unknown', () => {
  const src = 'http://127.0.0.1:5000/att?key=abc'
  expect(retryLocalhostSrc(src, 1, {address: ''})).toBe('http://127.0.0.1:5000/att?key=abc&kbRetry=1')
})
