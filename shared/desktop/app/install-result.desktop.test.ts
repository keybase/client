/// <reference types="jest" />
import {
  commandLineToolResult,
  legacyHelperInstalled,
  legacyHelperRetirementResult,
} from './install-result.desktop'

const stdout = (result: unknown) => JSON.stringify(result)

test('success is the clipaths component status, even when exec reports an error', () => {
  const out = stdout({componentResults: [{name: 'clipaths', status: {code: 0, desc: 'OK'}}]})
  expect(commandLineToolResult(undefined, true, out)).toEqual({desc: 'OK', ok: true})
})

test('a failed or canceled prompt shows the component description', () => {
  const out = stdout({
    componentResults: [{exitCode: 2, name: 'clipaths', status: {code: 1601, desc: 'User canceled. (-128)'}}],
  })
  expect(commandLineToolResult('Command failed: keybase install', true, out)).toEqual({
    desc: 'User canceled. (-128)',
    ok: false,
  })
})

test('a fatal result with no components shows its own status', () => {
  const out = stdout({fatal: true, status: {desc: 'Keybase must be in /Applications'}})
  expect(commandLineToolResult('Command failed', true, out)).toEqual({
    desc: 'Keybase must be in /Applications',
    ok: false,
  })
})

test('unparseable output falls back to the exec error', () => {
  expect(commandLineToolResult('spawn EACCES', true, 'not json')).toEqual({desc: 'spawn EACCES', ok: false})
  expect(commandLineToolResult(undefined, true, '')).toEqual({
    desc: 'The install did not report a result.',
    ok: false,
  })
})

test('nothing ran when the installer was not found', () => {
  expect(commandLineToolResult(undefined, false, '')).toEqual({
    desc: 'Keybase could not find its command line installer.',
    ok: false,
  })
})

test('install-auto reports the legacy helper only with its OK helper result and exit code', () => {
  const helper = {exitCode: 7, name: 'helper', status: {code: 0, desc: 'the legacy helper is installed'}}
  const cli = {name: 'cli', status: {code: 0, desc: ''}}
  expect(legacyHelperInstalled({componentResults: [cli, helper]})).toBe(true)
  expect(legacyHelperInstalled({componentResults: [cli]})).toBe(false)
  expect(legacyHelperInstalled({componentResults: [{...helper, exitCode: 0}]})).toBe(false)
  expect(legacyHelperInstalled({componentResults: [{...helper, name: 'fuse'}]})).toBe(false)
  expect(legacyHelperInstalled(undefined)).toBe(false)
})

test('the legacy helper retirement result is the helper component status', () => {
  expect(
    legacyHelperRetirementResult(stdout({componentResults: [{name: 'helper', status: {code: 0, desc: 'OK'}}]}))
  ).toEqual({desc: 'OK', ok: true})
  expect(
    legacyHelperRetirementResult(
      stdout({componentResults: [{name: 'helper', status: {code: 1601, desc: 'administrator prompt canceled'}}]})
    )
  ).toEqual({desc: 'administrator prompt canceled', ok: false})
  expect(legacyHelperRetirementResult('not json')).toEqual({
    desc: 'The uninstall did not report a result.',
    ok: false,
  })
})
