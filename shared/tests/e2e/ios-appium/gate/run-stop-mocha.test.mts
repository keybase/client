/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
// bailEverySuite against the real mocha (ESM only, so node:test, not jest): once every suite bails, a
// failure ends the run and no later test or suite runs.
import {test} from 'node:test'
import assert from 'node:assert/strict'
import Mocha from 'mocha'
import {bailEverySuite} from './run-stop-lib.ts'

test('bailing every suite stops mocha after the next failure', async () => {
  const ran: Array<string> = []
  const mocha = new Mocha({reporter: 'json', reporterOptions: {output: '/dev/null'}})
  const root = mocha.suite
  const first = Mocha.Suite.create(root, 'first')
  first.addTest(new Mocha.Test('passes', () => void ran.push('passes')))
  first.addTest(
    new Mocha.Test('stops the run', () => {
      ran.push('stops the run')
      bailEverySuite(root)
      throw new Error('broken')
    })
  )
  first.addTest(new Mocha.Test('after in the same suite', () => void ran.push('after in the same suite')))
  const second = Mocha.Suite.create(root, 'second')
  second.addTest(new Mocha.Test('in a later suite', () => void ran.push('in a later suite')))
  const failures = await new Promise<number>(resolve => mocha.run(resolve))
  assert.equal(failures, 1)
  assert.deepEqual(ran, ['passes', 'stops the run'])
})

test('without the bail, the same failure runs on', async () => {
  const ran: Array<string> = []
  const mocha = new Mocha({reporter: 'json', reporterOptions: {output: '/dev/null'}})
  const first = Mocha.Suite.create(mocha.suite, 'first')
  first.addTest(
    new Mocha.Test('fails', () => {
      ran.push('fails')
      throw new Error('broken')
    })
  )
  first.addTest(new Mocha.Test('after in the same suite', () => void ran.push('after in the same suite')))
  await new Promise<number>(resolve => mocha.run(resolve))
  assert.deepEqual(ran, ['fails', 'after in the same suite'])
})
