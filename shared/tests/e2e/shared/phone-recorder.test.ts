import {recordingFrom, startRecorderBody, takeRecorderBody} from './phone-recorder'

const recording = {routes: ['loggedIn', 'settingsRoot'], rpcs: ['a.b'], startRoutes: ['loggedIn']}

// runs a body against a runtime whose recorder counts its takes
const runtime = (token: string) => {
  const calls: Array<string> = []
  const g = {
    __kbE2ERecorder: {
      start: (o: unknown) => void calls.push(`start ${JSON.stringify(o)}`),
      take: () => {
        calls.push('take')
        return {...recording, extra: 1}
      },
    },
    __kbE2ERuntime: token,
  }
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const run = (body: string) => (new Function('globalThis', body) as (g: unknown) => unknown)(g)
  return {calls, run}
}

test('a take from the runtime the recording started in takes it', () => {
  const rt = runtime('r1')
  const taken = rt.run(takeRecorderBody('r1')) as {runtime: string; recording: typeof recording}
  expect(rt.calls).toEqual(['take'])
  expect(recordingFrom('r1', taken)).toEqual(recording)
})

test('a take from another runtime leaves its recorder alone and holds no recording', () => {
  const rt = runtime('r2')
  const taken = rt.run(takeRecorderBody('r1')) as {runtime: string}
  expect(rt.calls).toEqual([])
  expect(taken).toEqual({runtime: 'r2'})
  expect(recordingFrom('r1', taken)).toBeUndefined()
})

test('a recording answered by another runtime is not kept', () => {
  expect(recordingFrom('r1', {recording, runtime: 'r2'})).toBeUndefined()
  expect(recordingFrom('r1', {runtime: null})).toBeUndefined()
})

test('start answers its runtime, and null without a recorder', () => {
  const rt = runtime('r1')
  expect(rt.run(startRecorderBody({includeBoot: true}))).toBe('r1')
  expect(rt.calls).toEqual(['start {"includeBoot":true}'])
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  expect((new Function('globalThis', startRecorderBody()) as (g: unknown) => unknown)({})).toBeNull()
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  expect((new Function('globalThis', takeRecorderBody('r1')) as (g: unknown) => unknown)({})).toBeNull()
})
