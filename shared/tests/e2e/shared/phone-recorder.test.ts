import {
  callsSinceBody,
  NO_PHONE_RECORDER,
  pauseRecorderBody,
  recordingFrom,
  resumeRecorderBody,
  startPhoneRecorder,
  startRecorderBody,
  takePhoneRecorder,
  takeRecorderBody,
} from './phone-recorder'

const recording = {routes: ['loggedIn', 'settingsRoot'], rpcs: ['a.b'], startRoutes: ['loggedIn']}

// runs a body against a runtime whose recorder counts its takes
const runtime = (token: string) => {
  const calls: Array<string> = []
  const g = {
    __kbE2ERecorder: {
      calls: (since: number) => {
        calls.push(`calls ${since}`)
        return {calls: [{method: 'a.b', paused: false, seq: since + 1}], seq: since + 1}
      },
      pause: () => {
        calls.push('pause')
        return 'tok'
      },
      resume: (t: string) => void calls.push(`resume ${t}`),
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

test('start and take refuse an app with no recorder, through any eval channel', async () => {
  const none = async <R,>(_body: string) => Promise.resolve(null as R)
  await expect(startPhoneRecorder(none)).rejects.toThrow(NO_PHONE_RECORDER)
  await expect(takePhoneRecorder(none, 'r1')).rejects.toThrow(NO_PHONE_RECORDER)
  await expect(startPhoneRecorder(async <R,>(_b: string) => Promise.resolve('r2' as R))).resolves.toBe('r2')
})

test('pause answers its token, resume hands the token back, and calls reads the log after a seq', () => {
  const rt = runtime('r1')
  expect(rt.run(pauseRecorderBody)).toBe('tok')
  expect(rt.run(resumeRecorderBody('tok'))).toBe(true)
  expect(rt.run(callsSinceBody(4))).toEqual({calls: [{method: 'a.b', paused: false, seq: 5}], seq: 5})
  expect(rt.calls).toEqual(['pause', 'resume tok', 'calls 4'])
})

test('pause, resume and calls answer null without a recorder', () => {
  for (const body of [pauseRecorderBody, resumeRecorderBody('tok'), callsSinceBody(0)]) {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    expect((new Function('globalThis', body) as (g: unknown) => unknown)({})).toBeNull()
  }
})
