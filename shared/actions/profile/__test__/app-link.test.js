// @noflow
/* eslint-env jest */
import {URL} from 'whatwg-url'
import {urlToUsername} from '../app-link'

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
})
