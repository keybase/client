/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {diffSeals, hashFields, normalize} from './seal.mts'

test('normalize sorts inbox rows and keeps only stable keys', () => {
  const raw = {
    result: {
      conversations: [
        {
          active_at_ms: 2,
          channel: {name: 'testuser,testuser-mac'},
          extra_volatile: 1,
          id: 'b',
          unread: false,
        },
        {active_at_ms: 1, channel: {name: 'testteam', topic_name: 'general'}, id: 'a', unread: false},
      ],
    },
  }
  assert.deepEqual(normalize('inbox', raw), [
    {activeAtMs: 1, id: 'a', name: 'testteam#general', unread: false},
    {activeAtMs: 2, id: 'b', name: 'testuser,testuser-mac', unread: false},
  ])
})

test('normalize teams keeps membership facts and team members, sorted', () => {
  const raw = {
    members: {
      members: {
        owners: [{fullName: 'x', joinTime: 5, role: 4, username: 'testuser'}],
        readers: null,
        writers: [{joinTime: 6, role: 2, username: 'testuser-mac'}],
      },
      name: 'testteam',
    },
    memberships: {
      teams: [
        {fq_name: 'testteam', is_open_team: false, member_count: 2, role: 1, status: 0, team_id: 'bb'},
        {fq_name: 'other', is_open_team: true, member_count: 7, role: 2, status: 0, team_id: 'aa'},
      ],
    },
  }
  assert.deepEqual(normalize('teams', raw), {
    members: [
      {role: 4, username: 'testuser'},
      {role: 2, username: 'testuser-mac'},
    ],
    memberships: [
      {isOpen: true, memberCount: 7, name: 'other', role: 2, teamId: 'aa'},
      {isOpen: false, memberCount: 2, name: 'testteam', role: 1, teamId: 'bb'},
    ],
  })
})

test('normalize follows sorts usernames and drops link ids', () => {
  const raw = {
    followers: 'testuser-mac\ntestuser\n',
    following: [
      {link_id: 'x', uid: 'u2', username: 'testuser-mac'},
      {link_id: 'y', uid: 'u1', username: 'testuser'},
    ],
  }
  assert.deepEqual(normalize('follows', raw), {
    followers: ['testuser', 'testuser-mac'],
    following: ['testuser', 'testuser-mac'],
  })
})

test('normalize devices parses the table by column and drops Created and Last Used', () => {
  const raw = [
    'Name                                    Type         ID                                 Created                Last Used',
    '==========                              ==========   ==========                         ==========             ==========',
    'my laptop                               desktop      bbbb                               2019 Aug 1 15:05:29    2022 Apr 27 11:58:21',
    'phone                                   mobile       aaaa                               2020 Jan 7 14:17:02    2020 Jan 8 11:44:23',
    '',
  ].join('\n')
  assert.deepEqual(normalize('devices', raw), [
    {id: 'aaaa', name: 'phone', type: 'mobile'},
    {id: 'bbbb', name: 'my laptop', type: 'desktop'},
  ])
})

test('normalize kbfs strips colour codes and sorts names', () => {
  assert.deepEqual(normalize('kbfs', '\u001b[0;34mzdir\u001b[0m\nafile.txt\n'), ['afile.txt', 'zdir'])
  assert.deepEqual(normalize('kbfs', ''), [])
  assert.deepEqual(normalize('kbfsPrivate', 'b.png\na.txt\n'), ['a.txt', 'b.png'])
})

test('diffSeals names the changed path', () => {
  const a = {fields: {inbox: [{activeAtMs: 1, id: 'a'}]}, hash: '', newestMessageMs: 1, takenAt: 0}
  const b = {fields: {inbox: [{activeAtMs: 5, id: 'a'}]}, hash: '', newestMessageMs: 5, takenAt: 0}
  assert.deepEqual(diffSeals({...a, hash: hashFields(a.fields)}, {...b, hash: hashFields(b.fields)}), [
    'inbox[0].activeAtMs: 1 → 5',
  ])
})

test('diffSeals reports added and removed rows and keys', () => {
  const a = {fields: {inbox: [{id: 'a'}], kbfs: ['x']}, hash: '', newestMessageMs: 0, takenAt: 0}
  const b = {fields: {devices: [], inbox: [{id: 'a'}, {id: 'b'}]}, hash: '', newestMessageMs: 0, takenAt: 0}
  assert.deepEqual(diffSeals(a, b), ['devices: added', 'inbox[1]: added', 'kbfs: removed'])
})

test('hashFields ignores key order', () => {
  assert.equal(hashFields({a: 1, b: {c: 2, d: 3}}), hashFields({a: 1, b: {d: 3, c: 2}}))
  assert.notEqual(hashFields({a: 1}), hashFields({a: 2}))
})

test('equal seals diff empty', () => {
  const f = {follows: {followers: ['testuser'], following: []}}
  assert.deepEqual(
    diffSeals(
      {fields: f, hash: hashFields(f), newestMessageMs: 0, takenAt: 0},
      {fields: f, hash: hashFields(f), newestMessageMs: 0, takenAt: 9}
    ),
    []
  )
})
