// The dev app's route and RPC recorder (visual/fixtures/runtime.ts), driven over Metro's inspector
// on the phone. A JS reload or relaunch starts a new runtime and drops the recording, so a run
// checkpoints after any step that may do that.
import type {CallLog, LoggedCall} from '../../shared/call-log.ts'
import {listInspectorPages} from '../../shared/metro-eval.ts'
import {
  callsSinceBody,
  NO_PHONE_RECORDER,
  pauseRecorderBody,
  recordingFrom,
  resumeRecorderBody,
  RUNTIME_BODY,
  startPhoneRecorder as startOn,
  takePhoneRecorder as takeOn,
} from '../../shared/phone-recorder.ts'
import {mergeRecordings, type Recording} from '../../shared/recorder.ts'
import {BUNDLE_ID, deviceName, jsEval, waitFor} from '../helpers/lifecycle'
import {pausedAround} from './harness-rpcs-lib.ts'
import {type CallMark, callMarkOf, callsInWindow, nextRecordingAction, uiCallsOf} from './recorder-lib.ts'
import {installAppLogCapture} from './app-log.ts'
import {ensureErrorCapture} from './errors.ts'
import {requireCurrentAttempt} from './attempt.ts'

const RELOAD_WAIT_MS = 60_000

const startPhoneRecorder = async (opts?: {includeBoot?: boolean}) => startOn(jsEval, opts)
const takePhoneRecorder = async (startedIn: string) => takeOn(jsEval, startedIn)

const pausePhoneRecorder = async (): Promise<string> => {
  const token = await jsEval<string | null>(pauseRecorderBody)
  if (!token) throw new Error(NO_PHONE_RECORDER)
  return token
}

const resumePhoneRecorder = async (token: string) => {
  if (!(await jsEval<boolean | null>(resumeRecorderBody(token)))) throw new Error(NO_PHONE_RECORDER)
}

// Runs f, which makes the app send RPCs itself (an eval calling an RPC or a store action that sends
// one), with the recorder paused, so the recording never credits them. Wrap only the eval and its own
// wait: a UI step inside the window would go uncredited.
export const withHarnessRpcs = async <R>(what: string, f: () => Promise<R>): Promise<R> =>
  pausedAround({pause: pausePhoneRecorder, resume: resumePhoneRecorder}, what, f)

const readCallLog = async (seq: number): Promise<CallLog> => {
  const log = await jsEval<CallLog | null>(callsSinceBody(seq))
  if (!log) throw new Error(NO_PHONE_RECORDER)
  return log
}

// A mark at the app's latest logged call, for a later callsSince. Throws when the recorder is off.
export const currentCallSeq = async (): Promise<CallMark> => callMarkOf(await readCallLog(Number.MAX_SAFE_INTEGER))

// The app's outgoing calls since `mark` (paused ones flagged), read off its recorder. Throws when the
// app's runtime changed or its recording stopped inside the window, so an absence never reads an
// empty log.
export const callsSince = async (mark: CallMark): Promise<Array<LoggedCall>> => callsInWindow(mark, await readCallLog(mark.seq))

// The calls of `method` the app's own UI made since `mark` (a call sent during a harness pause is
// not one), for presence and absence checks alike.
export const uiCallsSince = async (mark: CallMark, method: string) => uiCallsOf(await callsSince(mark), method)

// How many calls of `method` the app's own UI made since `mark`.
export const uiCallCount = async (mark: CallMark, method: string) => (await uiCallsSince(mark, method)).length

// Waits for the app's UI to send `method` after `mark`.
export const waitForUiCall = async (what: string, mark: CallMark, method: string, opts?: {interval?: number; timeout?: number}) =>
  waitFor(what, async () => ((await uiCallsSince(mark, method)).length > 0 ? true : undefined), {
    interval: opts?.interval ?? 250,
    timeout: opts?.timeout ?? 10_000,
  })

const currentRuntime = async (): Promise<string | undefined> => {
  try {
    if (!(await listInspectorPages()).some(p => p.deviceName === deviceName() && p.appId === BUNDLE_ID)) return undefined
    return (await jsEval<string | null>(RUNTIME_BODY)) ?? undefined
  } catch {
    return undefined
  }
}

const sleep = async (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export class PhoneRecording {
  private runtime = ''
  private kept: Array<Recording> = []
  private reloads = 0

  get reloadCount() {
    return this.reloads
  }

  get recordings(): ReadonlyArray<Recording> {
    return this.kept
  }

  async begin() {
    this.runtime = await startPhoneRecorder()
  }

  // A new runtime's recorder was never started, so it starts with what the runtime sent since boot.
  private async restart() {
    this.reloads++
    this.runtime = await startPhoneRecorder({includeBoot: true})
    await ensureErrorCapture()
    await installAppLogCapture()
  }

  async checkpoint() {
    const deadline = Date.now() + RELOAD_WAIT_MS
    for (;;) {
      requireCurrentAttempt()
      const action = nextRecordingAction(this.runtime, await currentRuntime())
      if (action === 'take') {
        // keeps what the app has recorded so far, which a reload during the next step would drop
        const got = recordingFrom(this.runtime, await takePhoneRecorder(this.runtime))
        // none: the app reloaded between reading its runtime and the take
        if (!got) return this.restart()
        this.kept.push(got)
        this.runtime = await startPhoneRecorder()
        return
      }
      if (action === 'restart') return this.restart()
      if (Date.now() > deadline) throw new Error(`the app did not come back within ${RELOAD_WAIT_MS}ms`)
      await sleep(500)
    }
  }

  async finish(): Promise<Recording & {reloads: number}> {
    const taken = await takePhoneRecorder(this.runtime)
    const got = recordingFrom(this.runtime, taken)
    if (!got) {
      throw new Error(`the app reloaded without a checkpoint: its recording before the reload is lost (runtime ${this.runtime} became ${taken.runtime ?? 'none'})`)
    }
    this.kept.push(got)
    return {...mergeRecordings(this.kept), reloads: this.reloads}
  }
}
