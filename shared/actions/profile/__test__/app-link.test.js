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
})
