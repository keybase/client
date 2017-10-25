// @noflow
/* eslint-env jest */
import {URL} from 'whatwg-url'
import {urlToUsername} from '../app-link'

describe('urlToUsername', () => {
  it('basic', () => {
    const link = 'https://keybase.io/chris'
    const url = new URL(link)
    const username = urlToUsername(url)
    expect(username).toBe('chris')
  })
})
