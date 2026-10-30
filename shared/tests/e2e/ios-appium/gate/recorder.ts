// The dev app's route and RPC recorder (visual/fixtures/runtime.ts), driven over Metro's inspector
// on the phone. A JS reload or relaunch starts a new runtime and drops the recording, so a run
// checkpoints after any step that may do that.
import type {CallLog} from '../../shared/call-log.ts'
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
import {BUNDLE_ID, deviceName, jsEval} from '../helpers/lifecycle'
import {pausedAround} from './harness-rpcs-lib.ts'
import {nextRecordingAction} from './recorder-lib.ts'
import {ensureErrorCapture} from './errors.ts'

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

// The app's outgoing calls since `seq` while recording (paused ones flagged), read off its recorder.
export const callsSince = async (seq: number): Promise<CallLog> => {
  const log = await jsEval<CallLog | null>(callsSinceBody(seq))
  if (!log) throw new Error(NO_PHONE_RECORDER)
  return log
}

// The seq of the app's latest logged call, for a later callsSince.
export const currentCallSeq = async () => (await callsSince(Number.MAX_SAFE_INTEGER)).seq

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
  }

  async checkpoint() {
    const deadline = Date.now() + RELOAD_WAIT_MS
    for (;;) {
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
