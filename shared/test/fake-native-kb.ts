/// <reference types="jest" />
import type {CodegenTypes} from 'react-native'
import type {Spec} from 'react-native-kb/src/NativeKb'

// The Kb TurboModule is the native edge. realKb runs react-native-kb's own JS wrapper over this fake,
// so its logic (subscription removal, the paste-image refcount, the platform gates on Platform.OS)
// runs as it does in the app. The wrapper is the copy in shared/node_modules/react-native-kb, the one
// the app builds: after an edit in rnmodules/react-native-kb, run `yarn sync:kb-modules` first.
// Subscriptions live as long as the test file's modules, as in the app, where the code under test
// subscribes as it loads.
//
//   jest.mock('react-native-kb', () => require('@/test/fake-native-kb').realKb())
//   import {fakeNativeKb} from '@/test/fake-native-kb'
//   fakeNativeKb.give({peekPushTap: () => null})
//   fakeNativeKb.emit('onPushTapAvailable', undefined)
//
// A method the test hasn't given throws when called, rather than answering for native.

type EventName = Extract<
  {[K in keyof Spec]-?: NonNullable<Spec[K]> extends CodegenTypes.EventEmitter<unknown> ? K : never}[keyof Spec],
  string
>
type Payload<E extends EventName> = NonNullable<Spec[E]> extends CodegenTypes.EventEmitter<infer T> ? T : never
type Methods = Omit<Spec, EventName | 'getConstants' | 'getTypedConstants'>
type Constants = ReturnType<Spec['getTypedConstants']>

type Subscription = {handler: (payload: unknown) => void}
const subscriptions = new Map<string, Set<Subscription>>()
const subscriptionsTo = (event: string) => {
  let subs = subscriptions.get(event)
  if (!subs) {
    subs = new Set()
    subscriptions.set(event, subs)
  }
  return subs
}

let methods: Partial<Methods> = {}
let constants: Constants = {
  androidIsDeviceSecure: false,
  androidIsTestDevice: false,
  appVersionCode: '',
  appVersionName: '',
  darkModeSupported: false,
  fsCacheDir: '',
  fsDownloadDir: '',
  guiConfig: '',
  serverConfig: '',
  uses24HourClock: false,
  version: '',
}

// Every event emitter on the spec is named on*, and no method is.
const native = new Proxy({} as Spec, {
  get: (_target, key) => {
    if (typeof key !== 'string') return undefined
    if (key === 'getTypedConstants') return () => constants
    if (key.startsWith('on')) {
      return (handler: (payload: unknown) => void) => {
        const sub = {handler}
        subscriptionsTo(key).add(sub)
        return {remove: () => subscriptionsTo(key).delete(sub)}
      }
    }
    return (
      (methods as Record<string, unknown>)[key] ??
      (() => {
        throw new Error(`NativeKb.${key} is not faked in this test: give it with fakeNativeKb.give`)
      })
    )
  },
})

export const fakeNativeKb = {
  // the native subscriptions an event has now
  count: (event: EventName) => subscriptionsTo(event).size,
  // native sends an event to every subscription, in the order they were made
  emit: <E extends EventName>(event: E, payload: Payload<E>) => {
    for (const sub of [...subscriptionsTo(event)]) sub.handler(payload)
  },
  // the native methods this test answers, replacing any given before
  give: (m: Partial<Methods>) => {
    methods = m
  },
}

// The real wrapper module over the fake, for a jest.mock('react-native-kb') factory. constants are
// what getTypedConstants answers, which the wrapper reads once as it loads.
export const realKb = (c?: Partial<Constants>) => {
  constants = {...constants, ...c}
  jest.doMock('react-native-kb/src/NativeKb', () => ({__esModule: true, default: native}))
  return jest.requireActual<object>('react-native-kb/src/index.tsx')
}

// for typing jest.requireActual in a factory
export type FakeNativeKbModule = {realKb: typeof realKb}
