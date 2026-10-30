// The phone app's route and RPC recorder (visual/fixtures/runtime.ts), reached by Metro eval bodies:
// the iOS gate and the iOS visual driver each run these through their own eval channel.
import type {Recording} from './recorder.ts'

export const NO_PHONE_RECORDER = 'the app has no __kbE2ERecorder: reload or relaunch the dev app on the current bundle'

// answers the app's JS runtime token (set at module load, so a reload changes it), or null
export const RUNTIME_BODY = 'return globalThis.__kbE2ERuntime ?? null'

// the caller's eval channel into the app
type PhoneEval = <R>(body: string) => Promise<R>

// Starts a recording and answers the JS runtime it started in, or null when the app has no recorder.
export const startRecorderBody = (opts?: {includeBoot?: boolean}) => `const r = globalThis.__kbE2ERecorder;
  if (!r || !globalThis.__kbE2ERuntime) return null;
  r.start(${JSON.stringify(opts ?? {})});
  return globalThis.__kbE2ERuntime;`

// What a take answered: the runtime's token, and the recording only when that runtime is the one it
// started in. Another runtime (a reload or relaunch since) is left untaken, so its boot list is still
// there for start({includeBoot: true}).
export type PhoneTake = {runtime: string | null; recording?: Recording}

// Answers null when the app has no recorder.
export const takeRecorderBody = (startedIn: string) => `const r = globalThis.__kbE2ERecorder;
  if (!r) return null;
  const runtime = globalThis.__kbE2ERuntime ?? null;
  if (runtime !== ${JSON.stringify(startedIn)}) return {runtime};
  return {runtime, recording: r.take()};`

// Starts a recording and answers the runtime it started in.
export const startPhoneRecorder = async (evalBody: PhoneEval, opts?: {includeBoot?: boolean}): Promise<string> => {
  const runtime = await evalBody<string | null>(startRecorderBody(opts))
  if (!runtime) throw new Error(NO_PHONE_RECORDER)
  return runtime
}

export const takePhoneRecorder = async (evalBody: PhoneEval, startedIn: string): Promise<PhoneTake> => {
  const out = await evalBody<PhoneTake | null>(takeRecorderBody(startedIn))
  if (!out) throw new Error(NO_PHONE_RECORDER)
  return out
}

// The recording a take holds, when it came from the runtime the recording started in.
export const recordingFrom = (startedIn: string, taken: PhoneTake): Recording | undefined => {
  if (taken.runtime !== startedIn || !taken.recording) return undefined
  const {routes, rpcs, startRoutes} = taken.recording
  return {routes, rpcs, startRoutes}
}

// Pauses the recorder and answers the pause's token, or null when the app has no recorder.
export const pauseRecorderBody = `const r = globalThis.__kbE2ERecorder;
  return r ? r.pause() : null;`

// Ends the pause `token` opened (a token this runtime never opened changes nothing); null when the
// app has no recorder.
export const resumeRecorderBody = (token: string) => `const r = globalThis.__kbE2ERecorder;
  if (!r) return null;
  r.resume(${JSON.stringify(token)});
  return true;`

// The recorder's call log after `seq` (CallLog in call-log.ts), or null when the app
// has no recorder.
export const callsSinceBody = (seq: number) => `const r = globalThis.__kbE2ERecorder;
  return r ? r.calls(${JSON.stringify(seq)}) : null;`
