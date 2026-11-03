import {hiddenSimctlArgs, maskedByRole, maskedRunError, scrub} from './run-errors-lib'

const udid = '00000000-1111-2222-3333-444444444444'
const link = 'keybase://profile/show/testuser'

test('a link, a path, a bundle id and coordinates are hidden; keywords and the UDID are not', () => {
  expect(hiddenSimctlArgs(['openurl', udid, link])).toEqual([link])
  expect(hiddenSimctlArgs(['addmedia', udid, '/Users/testuser-mac/a.png', '/tmp/b.mov'])).toEqual([
    '/Users/testuser-mac/a.png',
    '/tmp/b.mov',
  ])
  expect(hiddenSimctlArgs(['privacy', udid, 'grant', 'photos', 'keybase.ios'])).toEqual(['keybase.ios'])
  expect(hiddenSimctlArgs(['bootstatus', udid, '-b'])).toEqual([])
  expect(hiddenSimctlArgs(['location', udid, 'set', '37.1,-122.2'])).toEqual(['37.1,-122.2'])
})

test('a letters-only argument that is not a keyword the gate passes is hidden', () => {
  expect(hiddenSimctlArgs(['openurl', udid, 'testuser'])).toEqual(['testuser'])
  expect(hiddenSimctlArgs(['privacy', udid, 'grant', 'photos', 'some-team'])).toEqual(['some-team'])
  expect(hiddenSimctlArgs(['spawn', udid, 'log', 'show', '--start', '2026-10-31 08:00:00', '--style', 'compact'])).toEqual(['2026-10-31 08:00:00'])
})

test('a non-zero exit names the step and the exit, and its stderr has the hidden args replaced', () => {
  const e = Object.assign(new Error(`Command failed: xcrun simctl openurl ${udid} ${link}`), {
    status: 1,
    stderr: `An error was encountered processing the command: could not open ${link}\n`,
  })
  const m = maskedRunError('simctl openurl', e, 120_000, [link]).message
  expect(m).toBe('simctl openurl failed (exit 1): An error was encountered processing the command: could not open <hidden>')
  expect(m).not.toContain('testuser')
})

test('a timeout names the step and the bound, never the argv, and keeps no cause', () => {
  const e = Object.assign(new Error(`spawnSync xcrun ETIMEDOUT ${link}`), {code: 'ETIMEDOUT'})
  const err = maskedRunError('simctl openurl', e, 120_000, [link])
  expect(err.message).toBe('simctl openurl did not finish within 120s; killed it')
  expect(err.cause).toBeUndefined()
})

test('a kill by signal and a spawn failure say so; a Buffer stderr is read', () => {
  expect(maskedRunError('simctl push', {signal: 'SIGKILL', status: null}, 1000, []).message).toBe('simctl push failed (signal SIGKILL)')
  expect(maskedRunError('simctl push', {code: 'ENOENT'}, 1000, []).message).toBe('simctl push failed (ENOENT)')
  expect(maskedRunError('simctl push', {status: 2, stderr: Buffer.from('bad /tmp/x.json')}, 1000, ['/tmp/x.json']).message).toBe(
    'simctl push failed (exit 2): bad <hidden>'
  )
})

test('scrub replaces a longer hidden arg before a shorter one inside it', () => {
  expect(scrub('a /tmp/x/y b /tmp/x', ['/tmp/x', '/tmp/x/y'])).toBe('a <hidden> b <hidden>')
})

test('maskedByRole replaces each name with its role, the longest name first', () => {
  const roles = [
    {name: 'testuser', role: 'the smoke account'},
    {name: 'testuser-mac', role: 'the new computer'},
    {name: '', role: 'nothing'},
  ]
  expect(maskedByRole('testuser-mac of testuser failed', roles)).toBe('the new computer of the smoke account failed')
})
