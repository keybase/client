/* eslint-disable @typescript-eslint/no-floating-promises -- node:test registers top-level tests; they are not awaited */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import type {StoreApi, StoreKey} from './def.ts'
import type * as Runtime from './runtime.ts'

// the module installs itself only in a dev app
;(globalThis as {__DEV__?: boolean}).__DEV__ = false
const {createRuntime} = (await import('./runtime.ts')) as typeof Runtime

type Config = {globalError?: Error; runtimeStats?: unknown; loggedIn: boolean; dispatch: {setGlobalError: (e?: unknown) => void; other: () => void}}

// a zustand store: setState merges, or replaces with `replace`
const configStore = () => {
  const replaced: Array<boolean> = []
  const api: StoreApi & {state: Config} = {
    getState: () => api.state,
    setState: (next, replace) => {
      replaced.push(!!replace)
      api.state = replace ? (next as Config) : {...api.state, ...(next as Partial<Config>)}
    },
    state: {
      dispatch: {
        other: () => {},
        setGlobalError: e => api.setState({globalError: e ? (e as Error) : undefined}),
      },
      loggedIn: true,
    },
  }
  return {api, replaced}
}

const runtimeWith = (config: StoreApi) =>
  createRuntime({
    forget: () => {},
    inject: () => {},
    install: () => {},
    now: () => 1_000_000,
    stores: {get: (key: StoreKey) => (key === 'z:config' ? config : undefined)},
  })

test('global-error keeps its error up when the app clears it, as desktop does after 10s, until end', () => {
  const {api, replaced} = configStore()
  const original = api.state
  const rt = runtimeWith(api)
  rt.fixtures.begin('global-error', {})
  assert.equal(api.state.globalError?.message, 'The visual gate set this error.')
  assert.equal(api.state.loggedIn, true)
  assert.equal(api.state.dispatch.other, original.dispatch.other)
  assert.deepEqual(replaced, [false])
  api.state.dispatch.setGlobalError()
  assert.equal(api.state.globalError.message, 'The visual gate set this error.')
  const another = new Error('another')
  api.state.dispatch.setGlobalError(another)
  assert.equal(api.state.globalError, another)
  assert.deepEqual(rt.fixtures.end().storesNotRestored, [])
  assert.equal(api.state, original)
  api.state.dispatch.setGlobalError()
  assert.equal(api.state.globalError, undefined)
})

test('runtime-stats merges its stats into the config store', () => {
  const {api, replaced} = configStore()
  const rt = runtimeWith(api)
  rt.fixtures.begin('runtime-stats', {})
  assert.ok(api.state.runtimeStats)
  assert.equal(api.state.loggedIn, true)
  assert.deepEqual(replaced, [false])
  rt.fixtures.end()
})
