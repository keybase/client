// The dev app's route and RPC recorder (visual/fixtures/runtime.ts), driven over Metro's inspector
// on the phone. A JS reload or relaunch starts a new runtime and drops the recording, so a run
// checkpoints after any step that may do that.
import {evalInPage, inspectorPageFor, listInspectorPages} from '../../shared/metro-eval.ts'
import {mergeRecordings, type Recording} from '../../shared/recorder.ts'
import {nextRecordingAction} from './recorder-lib.ts'

const DEVICE = process.env['KB_IOS_DEVICE'] ?? 'iPhoneTest'
const APP_ID = 'keybase.ios'
const RELOAD_WAIT_MS = 60_000

const page = async () => inspectorPageFor(DEVICE, APP_ID)

export const startPhoneRecorder = async (opts?: {includeBoot?: boolean}): Promise<{runtime: string}> => {
  const out = await evalInPage<{runtime?: string} | null>(
    await page(),
    `const r = globalThis.__kbE2ERecorder;
     if (!r) return null;
     r.start(${JSON.stringify(opts ?? {})});
     return {runtime: globalThis.__kbE2ERuntime};`
  )
  if (!out?.runtime) throw new Error('the app has no __kbE2ERecorder: reload or relaunch the dev app on the current bundle')
  return {runtime: out.runtime}
}

export const takePhoneRecorder = async (): Promise<Recording & {runtime: string}> => {
  const out = await evalInPage<(Recording & {runtime?: string}) | null>(
    await page(),
    `const r = globalThis.__kbE2ERecorder;
     if (!r) return null;
     return {...r.take(), runtime: globalThis.__kbE2ERuntime};`
  )
  if (!out?.runtime) throw new Error('the app has no __kbE2ERecorder: reload or relaunch the dev app on the current bundle')
  return {...out, runtime: out.runtime}
}

const currentRuntime = async (): Promise<string | undefined> => {
  try {
    if (!(await listInspectorPages()).some(p => p.deviceName === DEVICE && p.appId === APP_ID)) return undefined
    return (await evalInPage<string | undefined>(await page(), 'return globalThis.__kbE2ERuntime')) ?? undefined
  } catch {
    return undefined
  }
}

const sleep = async (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export class PhoneRecording {
  private runtime: string | undefined
  private kept: Array<Recording> = []
  private reloads = 0

  get reloadCount() {
    return this.reloads
  }

  get recordings(): ReadonlyArray<Recording> {
    return this.kept
  }

  async begin() {
    this.runtime = (await startPhoneRecorder()).runtime
  }

  async checkpoint() {
    const deadline = Date.now() + RELOAD_WAIT_MS
    for (;;) {
      const action = nextRecordingAction(this.runtime, await currentRuntime())
      if (action === 'take') {
        // keeps what the app has recorded so far, which a reload during the next step would drop
        this.kept.push(await takePhoneRecorder())
        this.runtime = (await startPhoneRecorder()).runtime
        return
      }
      if (action === 'restart') {
        this.reloads++
        this.runtime = (await startPhoneRecorder({includeBoot: true})).runtime
        return
      }
      if (Date.now() > deadline) throw new Error(`the app did not come back within ${RELOAD_WAIT_MS}ms`)
      await sleep(500)
    }
  }

  async finish(): Promise<Recording & {reloads: number}> {
    const got = await takePhoneRecorder()
    this.kept.push(got)
    return {...mergeRecordings(this.kept), reloads: this.reloads}
  }
}
