/* eslint-env jest */
import URL from 'url-parse'
import {urlToUsername} from '../../../constants/config'

describe('urlToUsername', () => {
  function check(link, expectedUsername) {
    const url = new URL(link)
    const username = urlToUsername(url)
    expect(username).toBe(expectedUsername)
  }

  it('basic', () => {
    check('https://keybase.io/chris', 'chris')
    check('http://keybase.io/chris', 'chris')
    check('https://www.keybase.io/chris', 'chris')
    check('https://keybase.io/chris', 'chris')

    check('https://api.keybase.io/chris', null)
    check('ftp://keybase.io/chris', null)
  })

  it('case', () => {
    check('Https://keybase.io/chris', 'chris')
    check('Http://keybase.io/chris', 'chris')
    check('https://KeyBase.io/chris', 'chris')
    check('https://KeyBase.io/Chris', 'chris')
  })

  it('extraneous', () => {
    check('https://keybase.io/chris?foo=bar', 'chris')
    check('https://keybase.io/chris#baz', 'chris')
    check('https://keybase.io/chris?foo=bar#baz', 'chris')
    check('https://keybase.io/chris?foo=bar#baz', 'chris')
  })

  it('path', () => {
    check('https://keybase.io/chris/', 'chris')

    check('https://keybase.io/chris//', null)
    check('https://keybase.io/chris/bar', null)
  })

  it('weird', () => {
    check('https://keybase.io:443/chris', 'chris')
    check('http://keybase.io:80/chris', 'chris')

    check('https://keybase.io:80/chris', null)
    check('http://keybase.io:443/chris', null)

    check('https://foo@keybase.io/chris', null)
    check('https://foo:@keybase.io/chris', null)
    check('https://:bar@keybase.io/chris', null)
    check('https://foo:bar@keybase.io/chris', null)
  })

  it('usernames', () => {
    check('https://keybase.io:443/Aa', 'aa')
    check('http://keybase.io:80/0123456789abcdeF', '0123456789abcdef')
    check('https://keybase.io:443/A_B', 'a_b')

    check('https://keybase.io:443/A', null)
    check('https://keybase.io:443/A__B', null)
  })
})
