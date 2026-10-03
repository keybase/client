import * as K from './waiting-keys'
import type {WaitingKey, WaitingKeys} from './waiting-key-type'
import {testWaitingKey} from '@/test/waiting-key'

const accept = (k: WaitingKey) => k
const acceptMany = (k: WaitingKeys) => k

test('registered keys and builder results are waiting keys', () => {
  expect(accept(K.waitingKeyProvision)).toBe('provision:waiting')
  expect(accept(K.waitingKeyTeamsTeam('t1'))).toBe('team:t1')
  expect(accept(K.waitingKeyTeamsAddMember('t1', 'testuser', 'testuser-mac'))).toBe(
    'teamAdd:t1;testuser,testuser-mac'
  )
  expect(accept(K.waitingKeyChatThreadLoad('c1'))).toBe('chat:loadingThread:c1')
  expect(accept(K.waitingKeyUnlockFolders)).toBe('unlock-folders:waiting')
  // a builder's shape is a key whatever its argument
  expect(accept(`team:${'anything'}`)).toBe('team:anything')
  expect(accept(testWaitingKey('test:made-up'))).toBe('test:made-up')
  expect(acceptMany([K.waitingKeyTeamsTeam('t1'), K.waitingKeyTeamsTeamTars('t1')])).toEqual([
    'team:t1',
    'teamTars:t1',
  ])
})

test('the type refuses what the registry does not hold', () => {
  // @ts-expect-error a typo of a registered key
  accept('provision:wating')
  // @ts-expect-error a builder's suffix under the wrong prefix
  accept('teamz:t1')
  const raw: string = 'provision:waiting'
  // @ts-expect-error a plain string, even one that holds a key's value
  accept(raw)
  // @ts-expect-error a plain string among registered keys
  acceptMany([K.waitingKeyProvision, raw])
})
