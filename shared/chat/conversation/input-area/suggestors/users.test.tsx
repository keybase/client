/** @jest-environment jsdom */
/// <reference types="jest" />
import {filterAndJoin, transformer} from './users'
import type {TeamListItem, UserListItem} from './users'

const user = (username: string, fullName = ''): UserListItem => ({fullName, username})
const channel = (teamname: string, channelname: string): TeamListItem => ({channelname, teamname})
const team = (teamname: string): TeamListItem => ({channelname: '', teamname})

const tData = {position: {end: 3, start: 0}, text: '@al'}

describe('transformer', () => {
  test('inserts a username and a trailing space', () => {
    expect(transformer({fullName: 'Alice', username: 'alice'}, '@', tData, false)).toEqual({
      selection: {end: 7, start: 7},
      text: '@alice ',
    })
  })

  test('preview mode inserts without the trailing space', () => {
    expect(transformer({fullName: 'Alice', username: 'alice'}, '@', tData, true)).toEqual({
      selection: {end: 6, start: 6},
      text: '@alice',
    })
  })

  test('a team without a channel inserts just the team', () => {
    expect(
      transformer({fullName: '', teamname: 'acme', username: 'ignored'}, '@', tData, true).text
    ).toBe('@acme')
  })

  test('a team with a channel inserts team#channel', () => {
    expect(
      transformer(
        {channelname: 'general', fullName: '', teamname: 'acme', username: 'ignored'},
        '@',
        tData,
        true
      ).text
    ).toBe('@acme#general')
  })
})

describe('filterAndJoin', () => {
  const users = [user('alice', 'Alice Anderson'), user('bob', 'Bob Baker'), user('carol', 'Alice Carter')]
  const teams = [team('acme'), team('acmecorp')]
  const allChannels = [channel('acme', 'general'), channel('acme', 'random'), channel('acmecorp', 'general')]

  test('an empty filter returns everyone with teams sorted by name', () => {
    const result = filterAndJoin(users, [team('zebra'), team('acme')], allChannels, '')
    expect(result).toEqual([...users, team('acme'), team('zebra')])
  })

  test('username prefix outranks fullname prefix, which outranks a substring match', () => {
    // 'al': alice matches username prefix (3), carol matches fullname prefix (2)
    const result = filterAndJoin(users, [], allChannels, 'al')
    expect(result).toEqual([user('alice', 'Alice Anderson'), user('carol', 'Alice Carter')])
  })

  test('non-matching users are dropped', () => {
    expect(filterAndJoin(users, [], allChannels, 'zzz')).toEqual([])
  })

  test('teams match on a plain substring', () => {
    const result = filterAndJoin([], teams, allChannels, 'acmec')
    // a lone team result also offers its channels
    expect(result).toEqual([team('acmecorp'), channel('acmecorp', 'general')])
  })

  test('a lone team result only expands when no users matched', () => {
    const result = filterAndJoin([user('acmebot', '')], [team('acmecorp')], allChannels, 'acme')
    expect(result).toEqual([user('acmebot', ''), team('acmecorp')])
  })

  test('team# lists every channel in that team', () => {
    expect(filterAndJoin(users, teams, allChannels, 'acme#')).toEqual([
      channel('acme', 'general'),
      channel('acme', 'random'),
    ])
  })

  test('team#partial ranks channel prefix matches first', () => {
    const channels = [channel('acme', 'general'), channel('acme', 'ungeneral'), channel('acme', 'random')]
    expect(filterAndJoin(users, teams, channels, 'acme#gen')).toEqual([
      channel('acme', 'general'),
      channel('acme', 'ungeneral'),
    ])
  })

  test('a team# filter for an unknown team yields nothing, not a user search', () => {
    expect(filterAndJoin(users, teams, allChannels, 'nosuchteam#')).toEqual([])
  })
})
