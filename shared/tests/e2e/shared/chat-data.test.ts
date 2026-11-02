import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {newRunId} from '../accounts/run-id'
import {createThrowawaySubteam, directReadFailure, newestDrawn, NoMessagesYet} from './chat-data'

// A stand-in `keybase` (KB_CLI): `team create` passes, `team add-member` fails, and `team delete`
// asks for its confirmation and then fails.
const fakeKeybase = `#!/bin/sh
case "$1 $2" in
  "team create") exit 0 ;;
  "team add-member") echo "add-member boom" >&2; exit 1 ;;
  "team delete") printf 'please type: '; read answer; echo "delete boom"; exit 1 ;;
esac
echo "unexpected: $*" >&2
exit 3
`

const saved = {...process.env}
let dir = ''
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-data-'))
  const bin = path.join(dir, 'keybase')
  fs.writeFileSync(bin, fakeKeybase, {mode: 0o700})
  Object.assign(process.env, {
    KB_CLI: bin,
    KB_E2E_RUN_ID: newRunId(),
    KB_E2E_TEAM: 'testteam',
    KB_SECOND_USER: 'testuser-mac',
    KB_SMOKE_USER: 'testuser',
  })
  jest.spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => {
  process.env = {...saved}
  jest.restoreAllMocks()
  fs.rmSync(dir, {force: true, recursive: true})
})

test('createThrowawaySubteam keeps the setup error when deleting the half-made subteam fails too', async () => {
  const err = await createThrowawaySubteam('x').then(
    () => {
      throw new Error('the create passed')
    },
    (e: unknown) => e as AggregateError
  )
  expect(err).toBeInstanceOf(AggregateError)
  expect(err.message).toMatch(/add-member boom.*; and then deleting the subteam e2e[0-9a-z]{6}x failed: .*delete boom/s)
  expect(err.errors.map((e: unknown) => String(e))).toEqual([expect.stringMatching(/add-member boom/), expect.stringMatching(/delete boom/)])
  expect(String(err.cause)).toMatch(/delete boom/)
}, 20_000)

describe('directReadFailure', () => {
  const tlf = 'testuser,testuser-mac'
  test('a conversation that does not exist reads as NoMessagesYet', () => {
    expect(directReadFailure(new Error(`chat api read: no conversations matched "${tlf}"`), tlf)).toBeInstanceOf(NoMessagesYet)
  })

  test('any other failure is rethrown with the conversation and account names masked', () => {
    const e = directReadFailure(new Error(`chat api read: 504 Gateway Timeout for "${tlf}" (testuser-mac)`), tlf)
    expect(e).not.toBeInstanceOf(NoMessagesYet)
    expect(e.message).toContain('504 Gateway Timeout')
    expect(e.message).not.toMatch(/testuser/)
  })
})

const apiMsg = (id: number, type: string, body?: string) => ({
  msg: {content: {type, ...(body ? {text: {body}} : {})}, id, sender: {username: 'testuser'}},
})

test('the newest drawn message skips messages that did not unbox', () => {
  const res = {
    messages: [
      {error: 'could not unbox'},
      apiMsg(9, 'delete'),
      apiMsg(7, 'reaction'),
      apiMsg(6, 'deletehistory'),
      apiMsg(5, 'text', 'anchor'),
      apiMsg(4, 'text', 'older'),
    ],
  }
  expect(newestDrawn(res)?.id).toBe(5)
  expect(newestDrawn({messages: [{error: 'could not unbox'}, apiMsg(1, 'edit')]})).toBeUndefined()
  expect(newestDrawn({})).toBeUndefined()
})
