/* eslint-env jest */
import URL from 'url-parse'
import {urlToUsername, urlToTeamDeepLink} from '../../../constants/config'

describe('urlToUsername', () => {
  function check(link: string, expectedUsername: string | null) {
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

describe('urlToTeamLink', () => {
  function check(link: string, expectedTeamName: string | undefined, expectedAction: string | undefined) {
    const url = new URL(link)
    const ret = urlToTeamDeepLink(url)
    if (ret) {
      expect(ret.teamName).toBe(expectedTeamName)
      expect(ret.action).toBe(expectedAction)
    } else {
      expect(expectedTeamName).toBe(undefined)
      expect(expectedAction).toBe(undefined)
    }
  }

  it('basic', () => {
    check('https://keybase.io/team/foo', 'foo', undefined)
    check('https://keybase.io/team/foo.bar', 'foo.bar', undefined)
    check('https://keybase.io/team/foo-bar', 'foo-bar', undefined)
  })

  it('actions', () => {
    check('https://keybase.io/team/cats?applink=manage_settings', 'cats', 'manage_settings')
    check('https://keybase.io/team/dogs?applink=add_or_invite', 'dogs', 'add_or_invite')

    check('https://keybase.io/team/foo.bar?applink=manage_settings', 'foo.bar', 'manage_settings')
    check('https://keybase.io/team/foo.foo?applink=add_or_invite', 'foo.foo', 'add_or_invite')

    check('https://keybase.io/team/foo.foo?applink=bad_action', 'foo.foo', undefined)
  })

  it('bad', () => {
    // bad name
    check('https://keybase.io/team/f______b', undefined, undefined)

    // too short
    check('https://keybase.io/team/f', undefined, undefined)
    check('https://keybase.io/team/f?applink=manage_settings', undefined, undefined)

    // too long
    const longTeam = Buffer.alloc(300)
      .fill('a')
      .toString()
    check(`https://keybase.io/team/${longTeam}`, undefined, undefined)
    check(`https://keybase.io/team/${longTeam}?applink=add_or_invite`, undefined, undefined)
  })
})
