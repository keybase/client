import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {newRunId} from '../accounts/run-id'
import {createThrowawaySubteam} from './chat-data'

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
