import {attemptToken, openAttemptToken, type AttemptToken} from './attempt.ts'
import type {PhoneRecording} from './recorder.ts'

// errorsBefore: what the app logged before a relaunch ended its runtime, for afterTest to report
export type Recorder = {recording?: PhoneRecording; error?: string; captureError?: string; errorsBefore?: Array<string>}

// each attempt's recorder, so a timed-out body that finishes late reaches only its own
export const recorders = new WeakMap<AttemptToken, Recorder>()

// The running attempt's recording, for a flow that checkpoints after something that starts a new JS runtime.
export const attemptRecording = (): PhoneRecording => {
  const recording = recorders.get(attemptToken())?.recording
  if (!recording) throw new Error('the attempt has no recording')
  return recording
}

// The open attempt's recording, or undefined between attempts or when its recorder never started.
export const openAttemptRecording = (): PhoneRecording | undefined => {
  const token = openAttemptToken()
  return token && recorders.get(token)?.recording
}
