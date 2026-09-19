/// <reference types="jest" />
import {isLocalhostSrc, retryLocalhostSrc} from './localhost-src'

const httpSrv = {address: '127.0.0.1:61234', token: 'newtoken'}

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

test('a retry replaces the token param when there is one', () => {
  const src = 'http://127.0.0.1:5000/av?typ=user&name=testuser&token=oldtoken&count=0'
  expect(retryLocalhostSrc(src, 2, httpSrv)).toBe(
    'http://127.0.0.1:61234/av?typ=user&name=testuser&token=newtoken&count=0&kbRetry=2'
  )
})

test('a service restart on the same port still carries the new token', () => {
  const src = 'http://127.0.0.1:61234/av?typ=user&name=testuser&token=oldtoken&count=0'
  expect(retryLocalhostSrc(src, 1, {address: '127.0.0.1:61234', token: 'newtoken'})).toBe(
    'http://127.0.0.1:61234/av?typ=user&name=testuser&token=newtoken&count=0&kbRetry=1'
  )
})

test('a retry keeps the baked address when the current one is unknown', () => {
  const src = 'http://127.0.0.1:5000/att?key=abc'
  expect(retryLocalhostSrc(src, 1, {address: '', token: ''})).toBe(
    'http://127.0.0.1:5000/att?key=abc&kbRetry=1'
  )
})
