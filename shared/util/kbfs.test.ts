/// <reference types="jest" />
import {
  folderNameWithoutUsers,
  parseFolderNameToUsers,
  tlfToParticipantsOrTeamname,
  tlfToPreferredOrder,
} from './kbfs'

describe('parseFolderNameToUsers', () => {
  test('marks readers read-only and flags yourself', () => {
    expect(parseFolderNameToUsers('testuser', 'testuser,testuser-mac#reader')).toEqual([
      {username: 'testuser', you: true},
      {username: 'testuser-mac', you: false},
      {readOnly: true, username: 'reader', you: false},
    ])
  })

  test('ignores the tlf extension suffix', () => {
    expect(parseFolderNameToUsers('testuser', 'testuser,testuser-mac (conflicted copy)')).toEqual([
      {username: 'testuser', you: true},
      {username: 'testuser-mac', you: false},
    ])
  })

  test('drops empty usernames', () => {
    expect(parseFolderNameToUsers(undefined, 'testuser#')).toEqual([{username: 'testuser', you: false}])
    expect(parseFolderNameToUsers(undefined, '')).toEqual([])
  })
})

describe('folderNameWithoutUsers', () => {
  test('removes writers and readers, keeping the # separator only when readers remain', () => {
    expect(folderNameWithoutUsers('testuser,testuser-mac#reader', {testuser: true})).toBe(
      'testuser-mac#reader'
    )
    expect(folderNameWithoutUsers('testuser,testuser-mac#reader', {reader: true})).toBe(
      'testuser,testuser-mac'
    )
    expect(folderNameWithoutUsers('testuser,testuser-mac#reader', {reader: true, testuser: true})).toBe(
      'testuser-mac'
    )
  })

  test('a folder with no readers never grows a phantom empty reader', () => {
    // an empty reader half must stay empty rather than parsing as one nameless reader
    expect(folderNameWithoutUsers('testuser,testuser-mac#', {})).toBe('testuser,testuser-mac')
    expect(folderNameWithoutUsers('testuser,testuser-mac', {})).toBe('testuser,testuser-mac')
    expect(folderNameWithoutUsers('testuser,testuser-mac#', {testuser: true})).toBe('testuser-mac')
  })
})

describe('tlfToPreferredOrder', () => {
  test('hoists you to the front of the writers', () => {
    expect(tlfToPreferredOrder('other,testuser,zed', 'testuser')).toBe('testuser,other,zed')
  })

  test('hoists you to the front of the readers when you are only a reader', () => {
    expect(tlfToPreferredOrder('a,b#c,testuser', 'testuser')).toBe('a,b#testuser,c')
  })

  test('preserves the extension suffix', () => {
    expect(tlfToPreferredOrder('other,testuser (conflicted copy)', 'testuser')).toBe(
      'testuser,other (conflicted copy)'
    )
    expect(tlfToPreferredOrder('a#c,testuser (conflicted copy)', 'testuser')).toBe(
      'a#testuser,c (conflicted copy)'
    )
  })

  test('leaves the tlf alone when you are not in it', () => {
    expect(tlfToPreferredOrder('other,zed', 'testuser')).toBe('other,zed')
  })
})

describe('tlfToParticipantsOrTeamname', () => {
  test('returns participants for private and public tlfs', () => {
    expect(tlfToParticipantsOrTeamname('/keybase/private/testuser,testuser-mac')).toEqual({
      participants: ['testuser', 'testuser-mac'],
      teamname: undefined,
    })
    expect(tlfToParticipantsOrTeamname('/keybase/public/testuser')).toEqual({
      participants: ['testuser'],
      teamname: undefined,
    })
  })

  test('returns a teamname for team tlfs', () => {
    expect(tlfToParticipantsOrTeamname('/keybase/team/keybase')).toEqual({
      participants: undefined,
      teamname: 'keybase',
    })
  })

  test('returns nothing above the tlf level or for unknown types', () => {
    expect(tlfToParticipantsOrTeamname('/keybase/private')).toEqual({
      participants: undefined,
      teamname: undefined,
    })
    expect(tlfToParticipantsOrTeamname('/keybase/bogus/thing')).toEqual({
      participants: undefined,
      teamname: undefined,
    })
  })
})
