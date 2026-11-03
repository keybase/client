import type {CallLog, LoggedCall} from '../../shared/call-log.ts'

// What to do with the phone's recording once the app's JS runtime token is read again: the same
// runtime keeps its recording, a different one is a reload or relaunch that dropped it, and no
// token yet means the new runtime has not finished loading.
export const nextRecordingAction = (prev: string, now: string | undefined): 'take' | 'restart' | 'wait' =>
  now === undefined ? 'wait' : prev === now ? 'take' : 'restart'

// Where a call-log window starts: the app's runtime, its recording, and the latest seq in it.
export type CallMark = {runtime: string; generation: number; seq: number}

// The mark a log read opens a window at. A recorder that is not recording logs nothing, so a window
// opened then could only read empty.
export const callMarkOf = (log: CallLog): CallMark => {
  if (!log.recording) throw new Error("the app's recorder is not recording: a call-log window opened now would read nothing")
  return {generation: log.generation, runtime: log.runtime, seq: log.seq}
}

// The calls logged since `mark`, throwing when the log no longer covers the whole window: a new JS
// runtime (its seqs start again and it logs nothing until a recording starts), a recording that
// stopped inside it (calls between a take and the next start are never logged), or a bounded log that
// dropped calls from after the mark.
export const callsInWindow = (mark: CallMark, log: CallLog): Array<LoggedCall> => {
  if (log.runtime !== mark.runtime) throw new Error('the app started a new JS runtime inside the call-log window, so its calls from before are lost')
  if (!log.recording || log.generation !== mark.generation) {
    throw new Error("the app's recorder stopped inside the call-log window, so calls in it went unlogged")
  }
  if (mark.seq < log.droppedThrough) throw new Error("the call log lost the window's oldest calls")
  return log.calls
}

// The calls the app's own UI made: a call sent while a harness pause was open is the harness's.
export const uiCallsOf = (calls: ReadonlyArray<LoggedCall>, method: string) => calls.filter(c => !c.paused && c.method === method)
